-- =====================================================================
-- SalonDZ — schéma initial
-- Conventions : snake_case en base, camelCase dans l'API (mappé).
-- Fuseau unique : Africa/Algiers (UTC+1, pas d'heure d'été).
-- Semaine : 0 = dimanche … 6 = samedi (extract(dow) Postgres = même convention).
-- =====================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.user_role as enum ('client', 'pro');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.booking_source as enum ('online', 'walk_in', 'phone');
create type public.cancelled_by as enum ('client', 'salon', 'system');
create type public.gender_target as enum ('men', 'women', 'unisex');
create type public.notification_type as enum (
  'booking_created', 'booking_confirmed', 'booking_cancelled',
  'booking_rescheduled', 'booking_reminder', 'booking_completed'
);

-- ---------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- unaccent immutable (pour index / recherche)
create or replace function public.f_unaccent(text)
returns text language sql immutable parallel safe strict as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

create or replace function public.slugify(p_text text)
returns text language sql immutable strict as $$
  select trim(both '-' from regexp_replace(lower(public.f_unaccent(p_text)), '[^a-z0-9]+', '-', 'g'))
$$;

-- Réglages applicatifs (URL de l'API pour le cron, jeton interne) — lecture réservée au service.
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------
-- Profils (1:1 avec auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text,
  phone text,
  avatar_url text,
  gender text check (gender in ('male', 'female')),
  locale text not null default 'fr' check (locale in ('fr', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := 'client';
begin
  if new.raw_user_meta_data ->> 'role' in ('client', 'pro') then
    v_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  end if;
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    v_role,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(coalesce(new.phone, new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Catégories (référentiel)
-- ---------------------------------------------------------------------
create table public.categories (
  id text primary key,
  label_fr text not null,
  label_ar text not null,
  icon text not null default 'scissors',
  sort_order smallint not null default 0
);
insert into public.categories (id, label_fr, label_ar, icon, sort_order) values
  ('coiffure-homme', 'Coiffure homme', 'حلاقة رجال', 'scissors', 1),
  ('coiffure-femme', 'Coiffure femme', 'تصفيف شعر نساء', 'sparkles', 2),
  ('barbier', 'Barbier', 'حلاق لحية', 'brush', 3),
  ('esthetique', 'Esthétique', 'تجميل', 'flower', 4),
  ('onglerie', 'Onglerie', 'أظافر', 'hand', 5),
  ('maquillage', 'Maquillage', 'مكياج', 'palette', 6),
  ('epilation', 'Épilation', 'إزالة الشعر', 'feather', 7),
  ('spa-hammam', 'Spa & Hammam', 'سبا وحمام', 'droplets', 8);

-- ---------------------------------------------------------------------
-- Salons
-- ---------------------------------------------------------------------
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  phone text,
  wilaya_code smallint not null check (wilaya_code between 1 and 58),
  city text not null,
  address text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  cover_url text,
  gender_target public.gender_target not null default 'unisex',
  is_published boolean not null default false,
  slot_interval_minutes smallint not null default 15 check (slot_interval_minutes in (10, 15, 20, 30, 60)),
  booking_lead_time_minutes integer not null default 60 check (booking_lead_time_minutes >= 0),
  booking_horizon_days smallint not null default 30 check (booking_horizon_days between 1 and 90),
  auto_confirm boolean not null default true,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index salons_owner_idx on public.salons (owner_id);
create index salons_published_wilaya_idx on public.salons (wilaya_code, rating_avg desc) where is_published;
create index salons_search_trgm_idx on public.salons
  using gin (public.f_unaccent(name || ' ' || city) extensions.gin_trgm_ops);
create trigger trg_salons_updated_at before update on public.salons
  for each row execute function public.set_updated_at();

-- Slug automatique + unique
create or replace function public.salons_before_insert()
returns trigger language plpgsql as $$
declare
  v_base text;
  v_candidate text;
  v_i int := 0;
begin
  if new.slug is null or new.slug = '' then
    v_base := coalesce(nullif(public.slugify(new.name), ''), 'salon');
    v_base := left(v_base, 50);
    v_candidate := v_base;
    while exists (select 1 from public.salons where slug = v_candidate) loop
      v_i := v_i + 1;
      v_candidate := v_base || '-' || v_i;
    end loop;
    new.slug := v_candidate;
  end if;
  return new;
end $$;
create trigger trg_salons_before_insert before insert on public.salons
  for each row execute function public.salons_before_insert();

create table public.salon_categories (
  salon_id uuid not null references public.salons (id) on delete cascade,
  category_id text not null references public.categories (id),
  primary key (salon_id, category_id)
);
create index salon_categories_category_idx on public.salon_categories (category_id);

create table public.salon_photos (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  url text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index salon_photos_salon_idx on public.salon_photos (salon_id, sort_order);

-- ---------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  duration_minutes smallint not null check (duration_minutes between 5 and 480),
  price_da integer not null check (price_da >= 0),
  category_id text references public.categories (id),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_salon_idx on public.services (salon_id, sort_order);
create trigger trg_services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Équipe
-- ---------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index staff_salon_idx on public.staff (salon_id, sort_order);

-- Un membre par défaut (le propriétaire) à la création du salon
create or replace function public.salons_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select coalesce(nullif(full_name, ''), new.name) into v_name from public.profiles where id = new.owner_id;
  insert into public.staff (salon_id, user_id, display_name, sort_order)
  values (new.id, new.owner_id, coalesce(v_name, new.name), 0);
  return new;
end $$;
create trigger trg_salons_after_insert after insert on public.salons
  for each row execute function public.salons_after_insert();

-- ---------------------------------------------------------------------
-- Horaires
-- ---------------------------------------------------------------------
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  check (is_closed or opens_at < closes_at),
  unique (salon_id, day_of_week, opens_at)
);

-- Horaires spécifiques d'un membre (facultatif : sinon horaires du salon)
create table public.staff_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at),
  unique (staff_id, day_of_week, starts_at)
);

-- Blocages : congés, pauses, fermetures exceptionnelles (staff_id null = tout le salon)
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  staff_id uuid references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
create index time_blocks_salon_range_idx on public.time_blocks using gist (salon_id, tstzrange(starts_at, ends_at, '[)'));

-- ---------------------------------------------------------------------
-- Réservations — la contrainte d'exclusion est LA source de vérité anti-doublon
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  client_id uuid references public.profiles (id) on delete set null,
  staff_id uuid not null references public.staff (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  -- snapshots (le service peut changer de prix plus tard)
  service_name text not null,
  duration_minutes smallint not null check (duration_minutes > 0),
  price_da integer not null check (price_da >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  source public.booking_source not null default 'online',
  client_name text not null,
  client_phone text,
  notes text,
  cancelled_at timestamptz,
  cancelled_by public.cancelled_by,
  cancellation_reason text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index bookings_salon_start_idx on public.bookings (salon_id, starts_at);
create index bookings_client_start_idx on public.bookings (client_id, starts_at desc);
create index bookings_reminder_idx on public.bookings (starts_at) where status = 'confirmed' and reminder_sent_at is null;
create trigger trg_bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
-- Realtime : old row complète sur UPDATE (filtres RLS)
alter table public.bookings replica identity full;

-- ---------------------------------------------------------------------
-- Avis, favoris, push, notifications
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index reviews_salon_idx on public.reviews (salon_id, created_at desc);

create or replace function public.reviews_refresh_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid := coalesce(new.salon_id, old.salon_id);
begin
  update public.salons s set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews r where r.salon_id = v_salon), 0),
    rating_count = (select count(*) from public.reviews r where r.salon_id = v_salon)
  where s.id = v_salon;
  return null;
end $$;
create trigger trg_reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.reviews_refresh_rating();

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  salon_id uuid not null references public.salons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, salon_id)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  booking_id uuid references public.bookings (id) on delete cascade,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

-- ---------------------------------------------------------------------
-- Helpers RLS
-- ---------------------------------------------------------------------
create or replace function public.is_salon_owner(p_salon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.salons s where s.id = p_salon_id and s.owner_id = auth.uid())
$$;

create or replace function public.is_salon_published(p_salon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.salons s where s.id = p_salon_id and s.is_published)
$$;

create or replace function public.staff_salon_id(p_staff_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select salon_id from public.staff where id = p_staff_id
$$;

-- ---------------------------------------------------------------------
-- Notifications automatiques sur les réservations
-- ---------------------------------------------------------------------
create or replace function public.fmt_booking_when(p_ts timestamptz)
returns text language sql immutable as $$
  select to_char(p_ts at time zone 'Africa/Algiers', 'DD/MM à HH24:MI')
$$;

create or replace function public.bookings_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_salon_name text;
  v_when text;
  v_data jsonb;
begin
  select owner_id, name into v_owner, v_salon_name from public.salons where id = new.salon_id;
  v_when := public.fmt_booking_when(new.starts_at);
  v_data := jsonb_build_object('bookingId', new.id, 'salonId', new.salon_id, 'status', new.status);

  if tg_op = 'INSERT' then
    if new.source = 'online' then
      insert into public.notifications (user_id, type, title, body, data, booking_id)
      values (v_owner, 'booking_created', 'Nouvelle réservation',
        new.client_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);
      if new.client_id is not null then
        insert into public.notifications (user_id, type, title, body, data, booking_id)
        values (new.client_id,
          case when new.status = 'confirmed' then 'booking_confirmed' else 'booking_created' end,
          case when new.status = 'confirmed' then 'Réservation confirmée' else 'Demande envoyée' end,
          v_salon_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    if new.status = 'confirmed' and new.client_id is not null then
      insert into public.notifications (user_id, type, title, body, data, booking_id)
      values (new.client_id, 'booking_confirmed', 'Réservation confirmée',
        v_salon_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);
    elsif new.status = 'cancelled' then
      if new.cancelled_by = 'client' then
        insert into public.notifications (user_id, type, title, body, data, booking_id)
        values (v_owner, 'booking_cancelled', 'Réservation annulée',
          new.client_name || ' a annulé · ' || new.service_name || ' · ' || v_when, v_data, new.id);
      elsif new.client_id is not null then
        insert into public.notifications (user_id, type, title, body, data, booking_id)
        values (new.client_id, 'booking_cancelled', 'Réservation annulée',
          v_salon_name || ' a annulé · ' || new.service_name || ' · ' || v_when
          || coalesce(' — ' || new.cancellation_reason, ''), v_data, new.id);
      end if;
    elsif new.status = 'completed' and new.client_id is not null then
      insert into public.notifications (user_id, type, title, body, data, booking_id)
      values (new.client_id, 'booking_completed', 'Merci pour votre visite',
        'Donnez votre avis sur ' || v_salon_name, v_data, new.id);
    end if;
  elsif new.starts_at is distinct from old.starts_at and new.client_id is not null
        and new.status in ('pending', 'confirmed') then
    insert into public.notifications (user_id, type, title, body, data, booking_id)
    values (new.client_id, 'booking_rescheduled', 'Réservation déplacée',
      v_salon_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);
  end if;
  return new;
end $$;
create trigger trg_bookings_notify after insert or update on public.bookings
  for each row execute function public.bookings_notify();

-- ---------------------------------------------------------------------
-- Disponibilités : créneaux libres d'un jour pour un service
-- Source de vérité unique — create_booking s'appuie dessus.
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_salon_id uuid,
  p_service_id uuid,
  p_date date,
  p_staff_id uuid default null,
  p_enforce_lead_time boolean default true
)
returns table (slot_start timestamptz, staff_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_salon public.salons%rowtype;
  v_service public.services%rowtype;
  v_dow int;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_min_start timestamptz;
  v_duration interval;
  v_step interval;
begin
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then return; end if;
  select * into v_service from public.services where id = p_service_id and salon_id = p_salon_id;
  if not found then return; end if;

  v_dow := extract(dow from p_date)::int; -- 0 = dimanche
  v_day_start := (p_date::timestamp) at time zone 'Africa/Algiers';
  v_day_end := v_day_start + interval '1 day';
  v_duration := make_interval(mins => v_service.duration_minutes);
  v_step := make_interval(mins => v_salon.slot_interval_minutes);
  v_min_start := case when p_enforce_lead_time
    then now() + make_interval(mins => v_salon.booking_lead_time_minutes)
    else now() - interval '1 day' end;

  return query
  with staff_set as (
    select s.id
    from public.staff s
    where s.salon_id = p_salon_id and s.is_active
      and (p_staff_id is null or s.id = p_staff_id)
  ),
  windows as (
    -- membre avec horaires propres : intersection avec les horaires du salon
    select ss.id as sid,
           greatest(v_day_start + sh.starts_at::interval, v_day_start + oh.opens_at::interval) as win_start,
           least(v_day_start + sh.ends_at::interval, v_day_start + oh.closes_at::interval) as win_end
    from staff_set ss
    join public.staff_hours sh on sh.staff_id = ss.id and sh.day_of_week = v_dow
    join public.opening_hours oh on oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
    where sh.starts_at < oh.closes_at and sh.ends_at > oh.opens_at
    union all
    -- membre sans horaires propres : horaires du salon
    select ss.id,
           v_day_start + oh.opens_at::interval,
           v_day_start + oh.closes_at::interval
    from staff_set ss
    join public.opening_hours oh on oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
    where not exists (select 1 from public.staff_hours sh where sh.staff_id = ss.id and sh.day_of_week = v_dow)
  ),
  candidates as (
    select w.sid, gs as s_start
    from windows w
    cross join lateral generate_series(w.win_start, w.win_end - v_duration, v_step) as gs
  ),
  busy as (
    select b.staff_id as sid, tstzrange(b.starts_at, b.ends_at, '[)') as r
    from public.bookings b
    where b.salon_id = p_salon_id and b.status in ('pending', 'confirmed')
      and b.starts_at < v_day_end and b.ends_at > v_day_start
    union all
    select tb.staff_id, tstzrange(tb.starts_at, tb.ends_at, '[)')
    from public.time_blocks tb
    where tb.salon_id = p_salon_id and tb.starts_at < v_day_end and tb.ends_at > v_day_start
  )
  select distinct c.s_start, c.sid
  from candidates c
  where c.s_start >= v_min_start
    and not exists (
      select 1 from busy b
      where (b.sid is null or b.sid = c.sid)
        and b.r && tstzrange(c.s_start, c.s_start + v_duration, '[)')
    )
  order by c.s_start, c.sid;
end $$;

-- ---------------------------------------------------------------------
-- Création atomique d'une réservation
-- Règles côté client (p_enforce_rules = true) : salon publié, service actif,
-- délai minimum, horizon, créneau dans get_available_slots.
-- Côté pro (false) : seule l'absence de chevauchement est garantie.
-- Si p_staff_id est null : premier membre disponible (ordre sort_order).
-- La contrainte d'exclusion tranche les courses concurrentes.
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
  p_salon_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_client_id uuid,
  p_client_name text,
  p_client_phone text default null,
  p_notes text default null,
  p_source public.booking_source default 'online',
  p_enforce_rules boolean default true
)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_salon public.salons%rowtype;
  v_service public.services%rowtype;
  v_booking public.bookings%rowtype;
  v_local_date date;
  v_today date;
  v_ends timestamptz;
  v_candidates uuid[];
  v_staff uuid;
  v_status public.booking_status;
  v_dow int;
begin
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then
    raise exception 'SALON_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_service from public.services where id = p_service_id and salon_id = p_salon_id;
  if not found then
    raise exception 'SERVICE_INACTIVE' using errcode = 'P0001';
  end if;

  v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_date := (p_starts_at at time zone 'Africa/Algiers')::date;
  v_today := (now() at time zone 'Africa/Algiers')::date;
  v_dow := extract(dow from v_local_date)::int;

  if p_enforce_rules then
    if not v_salon.is_published then
      raise exception 'SALON_NOT_PUBLISHED' using errcode = 'P0001';
    end if;
    if not v_service.is_active then
      raise exception 'SERVICE_INACTIVE' using errcode = 'P0001';
    end if;
    if p_starts_at < now() then
      raise exception 'IN_PAST' using errcode = 'P0001';
    end if;
    if p_starts_at < now() + make_interval(mins => v_salon.booking_lead_time_minutes) then
      raise exception 'TOO_SOON' using errcode = 'P0001';
    end if;
    if v_local_date > v_today + v_salon.booking_horizon_days then
      raise exception 'TOO_FAR' using errcode = 'P0001';
    end if;
    if p_staff_id is not null and not exists (
      select 1 from public.staff where id = p_staff_id and salon_id = p_salon_id and is_active
    ) then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;

    select array_agg(a.staff_id order by st.sort_order, st.created_at) into v_candidates
    from public.get_available_slots(p_salon_id, p_service_id, v_local_date, p_staff_id, true) a
    join public.staff st on st.id = a.staff_id
    where a.slot_start = p_starts_at;

    if v_candidates is null then
      -- Différencier "fermé" de "déjà pris"
      if not exists (
        select 1 from public.opening_hours oh
        where oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
          and (p_starts_at at time zone 'Africa/Algiers')::time >= oh.opens_at
          and (v_ends at time zone 'Africa/Algiers')::time <= oh.closes_at
      ) then
        raise exception 'OUTSIDE_OPENING_HOURS' using errcode = 'P0001';
      end if;
      raise exception 'SLOT_TAKEN' using errcode = 'P0001';
    end if;
  else
    if p_staff_id is null then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;
    select array[id] into v_candidates from public.staff
      where id = p_staff_id and salon_id = p_salon_id and is_active;
    if v_candidates is null then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  v_status := case
    when p_source <> 'online' or v_salon.auto_confirm then 'confirmed'::public.booking_status
    else 'pending'::public.booking_status end;

  foreach v_staff in array v_candidates loop
    begin
      insert into public.bookings (
        salon_id, client_id, staff_id, service_id, service_name, duration_minutes, price_da,
        starts_at, ends_at, status, source, client_name, client_phone, notes
      ) values (
        p_salon_id, p_client_id, v_staff, p_service_id, v_service.name, v_service.duration_minutes,
        v_service.price_da, p_starts_at, v_ends, v_status, p_source, p_client_name, p_client_phone, p_notes
      )
      returning * into v_booking;
      return v_booking;
    exception when exclusion_violation then
      -- Course perdue sur ce membre : on tente le suivant
      null;
    end;
  end loop;

  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;

-- Déplacement atomique (même garanties d'exclusion)
create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_staff_id uuid default null,
  p_enforce_rules boolean default true
)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_b public.bookings%rowtype;
  v_salon public.salons%rowtype;
  v_local_date date;
  v_candidates uuid[];
  v_staff uuid;
  v_ends timestamptz;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_b.status not in ('pending', 'confirmed') then
    raise exception 'BOOKING_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;
  select * into v_salon from public.salons where id = v_b.salon_id;
  v_ends := p_starts_at + make_interval(mins => v_b.duration_minutes);
  v_local_date := (p_starts_at at time zone 'Africa/Algiers')::date;

  -- Libérer temporairement l'ancien créneau pour ne pas se bloquer soi-même
  update public.bookings set status = 'cancelled' where id = p_booking_id;

  if p_enforce_rules then
    if p_starts_at < now() + make_interval(mins => v_salon.booking_lead_time_minutes) then
      raise exception 'TOO_SOON' using errcode = 'P0001';
    end if;
    select array_agg(a.staff_id order by (a.staff_id = v_b.staff_id) desc, st.sort_order) into v_candidates
    from public.get_available_slots(v_b.salon_id, v_b.service_id, v_local_date, coalesce(p_staff_id, null), true) a
    join public.staff st on st.id = a.staff_id
    where a.slot_start = p_starts_at;
    if v_candidates is null then raise exception 'SLOT_TAKEN' using errcode = 'P0001'; end if;
  else
    v_candidates := array[coalesce(p_staff_id, v_b.staff_id)];
  end if;

  foreach v_staff in array v_candidates loop
    begin
      update public.bookings
        set starts_at = p_starts_at, ends_at = v_ends, staff_id = v_staff, status = v_b.status
        where id = p_booking_id
        returning * into v_b;
      return v_b;
    exception when exclusion_violation then
      null;
    end;
  end loop;
  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;

-- Wrapper RPC sûr pour un client authentifié (force client_id = auth.uid())
create or replace function public.book_slot(
  p_salon_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_staff_id uuid default null,
  p_notes text default null
)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  return public.create_booking(
    p_salon_id, p_service_id, p_staff_id, p_starts_at, auth.uid(),
    coalesce(nullif(v_profile.full_name, ''), 'Client'), v_profile.phone, p_notes, 'online', true
  );
end $$;

revoke execute on function public.create_booking(uuid, uuid, uuid, timestamptz, uuid, text, text, text, public.booking_source, boolean) from public, anon, authenticated;
revoke execute on function public.reschedule_booking(uuid, timestamptz, uuid, boolean) from public, anon, authenticated;
grant execute on function public.book_slot(uuid, uuid, timestamptz, uuid, text) to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date, uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Recherche de salons (léger pour la 4G : une seule requête)
-- ---------------------------------------------------------------------
create or replace function public.search_salons(
  p_q text default null,
  p_wilaya smallint default null,
  p_city text default null,
  p_category text default null,
  p_gender public.gender_target default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, slug text, name text, city text, wilaya_code smallint, cover_url text,
  gender_target public.gender_target, rating_avg numeric, rating_count int,
  category_ids text[], min_price_da int, distance_km double precision
)
language sql stable security definer set search_path = public as $$
  select s.id, s.slug, s.name, s.city, s.wilaya_code, s.cover_url, s.gender_target,
    s.rating_avg, s.rating_count,
    coalesce((select array_agg(sc.category_id order by sc.category_id)
              from public.salon_categories sc where sc.salon_id = s.id), '{}'::text[]) as category_ids,
    (select min(sv.price_da) from public.services sv where sv.salon_id = s.id and sv.is_active) as min_price_da,
    case when p_lat is not null and p_lng is not null and s.lat is not null and s.lng is not null then
      6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(p_lng))
                + sin(radians(p_lat)) * sin(radians(s.lat))))
    end as distance_km
  from public.salons s
  where s.is_published
    and (p_wilaya is null or s.wilaya_code = p_wilaya)
    and (p_city is null or public.f_unaccent(s.city) ilike public.f_unaccent(p_city))
    and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
    and (p_category is null or exists (
      select 1 from public.salon_categories sc where sc.salon_id = s.id and sc.category_id = p_category))
    and (p_q is null or p_q = ''
      or public.f_unaccent(s.name || ' ' || s.city) ilike '%' || public.f_unaccent(p_q) || '%'
      or exists (select 1 from public.services sv where sv.salon_id = s.id and sv.is_active
                 and public.f_unaccent(sv.name) ilike '%' || public.f_unaccent(p_q) || '%'))
  order by
    (case when p_lat is not null and p_lng is not null and s.lat is not null then 0 else 1 end),
    12 asc nulls last,
    s.rating_avg desc, s.rating_count desc, s.created_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
$$;
grant execute on function public.search_salons(text, smallint, text, text, public.gender_target, double precision, double precision, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.salons enable row level security;
alter table public.salon_categories enable row level security;
alter table public.salon_photos enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.opening_hours enable row level security;
alter table public.staff_hours enable row level security;
alter table public.time_blocks enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles: lire son profil" on public.profiles for select using (auth.uid() = id);
create policy "profiles: modifier son profil" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- categories : public
create policy "categories: lecture publique" on public.categories for select using (true);

-- salons
create policy "salons: lecture publique si publié" on public.salons for select
  using (is_published or owner_id = auth.uid());
create policy "salons: créer (pro)" on public.salons for insert
  with check (owner_id = auth.uid());
create policy "salons: modifier (owner)" on public.salons for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "salons: supprimer (owner)" on public.salons for delete
  using (owner_id = auth.uid());

-- tables enfants d'un salon : lecture publique si salon publié (ou owner), écriture owner
create policy "salon_categories: lecture" on public.salon_categories for select
  using (public.is_salon_published(salon_id) or public.is_salon_owner(salon_id));
create policy "salon_categories: écriture owner" on public.salon_categories for all
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "salon_photos: lecture" on public.salon_photos for select
  using (public.is_salon_published(salon_id) or public.is_salon_owner(salon_id));
create policy "salon_photos: écriture owner" on public.salon_photos for all
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "services: lecture" on public.services for select
  using (public.is_salon_published(salon_id) or public.is_salon_owner(salon_id));
create policy "services: écriture owner" on public.services for all
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "staff: lecture" on public.staff for select
  using (public.is_salon_published(salon_id) or public.is_salon_owner(salon_id));
create policy "staff: écriture owner" on public.staff for all
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "opening_hours: lecture" on public.opening_hours for select
  using (public.is_salon_published(salon_id) or public.is_salon_owner(salon_id));
create policy "opening_hours: écriture owner" on public.opening_hours for all
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "staff_hours: lecture" on public.staff_hours for select
  using (public.is_salon_published(public.staff_salon_id(staff_id)) or public.is_salon_owner(public.staff_salon_id(staff_id)));
create policy "staff_hours: écriture owner" on public.staff_hours for all
  using (public.is_salon_owner(public.staff_salon_id(staff_id)))
  with check (public.is_salon_owner(public.staff_salon_id(staff_id)));

create policy "time_blocks: owner" on public.time_blocks for all
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

-- bookings : le client voit les siennes, l'owner celles de son salon.
-- INSERT uniquement via fonctions (security definer) → pas de policy insert.
create policy "bookings: lecture client" on public.bookings for select
  using (client_id = auth.uid());
create policy "bookings: lecture owner" on public.bookings for select
  using (public.is_salon_owner(salon_id));
create policy "bookings: modifier owner" on public.bookings for update
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

-- reviews
create policy "reviews: lecture publique" on public.reviews for select using (true);
create policy "reviews: créer pour sa réservation terminée" on public.reviews for insert
  with check (
    client_id = auth.uid()
    and exists (select 1 from public.bookings b where b.id = booking_id and b.client_id = auth.uid() and b.status = 'completed')
  );
create policy "reviews: modifier le sien" on public.reviews for update
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- favorites / push_tokens / notifications : propriétaire uniquement
create policy "favorites: own" on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_tokens: own" on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: lire les siennes" on public.notifications for select
  using (user_id = auth.uid());
create policy "notifications: marquer lues" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Realtime : uniquement pour l'affichage (jamais source de vérité)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.bookings;
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage : buckets publics (photos salons, avatars), écriture par propriétaire
-- Chemin attendu : salons/<salon_id>/<fichier>, avatars/<user_id>/<fichier>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('salons', 'salons', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "storage salons: lecture publique" on storage.objects for select
  using (bucket_id = 'salons');
create policy "storage salons: écriture owner" on storage.objects for insert
  with check (bucket_id = 'salons' and public.is_salon_owner((storage.foldername(name))[1]::uuid));
create policy "storage salons: maj owner" on storage.objects for update
  using (bucket_id = 'salons' and public.is_salon_owner((storage.foldername(name))[1]::uuid));
create policy "storage salons: suppression owner" on storage.objects for delete
  using (bucket_id = 'salons' and public.is_salon_owner((storage.foldername(name))[1]::uuid));

create policy "storage avatars: lecture publique" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "storage avatars: écriture own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage avatars: maj own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage avatars: suppression own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
