-- 0045 — Modération de la place de marché (lot 2 de `docs/ADMIN.md`).
--
-- Jusqu'ici la plateforme ne pouvait rien arrêter : `is_published` appartient au professionnel,
-- qui le remet à `true` ; `blocked_clients` est propre à UN salon ; un avis injurieux restait en
-- ligne. Cette migration donne à la plateforme trois leviers, et UN SEUL vocabulaire.
--
-- Suspendre un salon a deux degrés, parce que les deux situations existent :
--   • `frozen` — les réservations sont gelées. La page reste en ligne, les rendez-vous déjà pris
--     tiennent, mais plus rien de nouveau n'entre. C'est la mesure conservatoire, le temps de
--     comprendre.
--   • `hidden` — le salon disparaît de la place de marché. Il n'apparaît plus dans les listes, la
--     recherche ne le propose plus, sa page ne s'ouvre plus.
-- Dans les deux cas la suspension arrête ce qui ENTRE ; elle n'empêche jamais de clore ce qui est
-- déjà pris : confirmer, terminer ou annuler un rendez-vous existant reste possible, sans quoi on
-- laisserait des clients devant une porte close sans prévenir personne.
--
-- `is_published` n'est JAMAIS touché : c'est l'intention du professionnel, et la plateforme n'a
-- pas à la réécrire. La colonne calculée `is_visible` croise les deux, et c'est elle que la
-- recherche interroge — ainsi un levier oublié quelque part se voit tout de suite.

-- ---------------------------------------------------------------------------------------------
-- Suspension d'un salon
-- ---------------------------------------------------------------------------------------------
do $mig$ begin
  if not exists (select 1 from pg_type where typname = 'suspension_level') then
    create type public.suspension_level as enum ('frozen', 'hidden');
  end if;
end $mig$;

alter table public.salons
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_level public.suspension_level,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by uuid references public.profiles (id) on delete set null;

-- Un état suspendu sans degré, ou un degré sans état, ne veut rien dire.
alter table public.salons drop constraint if exists salons_suspension_coherente;
alter table public.salons add constraint salons_suspension_coherente
  check ((suspended_at is null) = (suspension_level is null));

-- Visible = publié par le professionnel ET non masqué par la plateforme. Un salon « gelé » reste
-- visible : ses clients doivent pouvoir le retrouver, le voir, l'appeler.
alter table public.salons drop column if exists is_visible;
alter table public.salons add column is_visible boolean
  generated always as (is_published and suspension_level is distinct from 'hidden') stored;

create index if not exists salons_visible_wilaya_idx
  on public.salons (wilaya_code, rating_avg desc) where is_visible;
create index if not exists salons_visible_geo_idx
  on public.salons (lat, lng) where is_visible;

-- ---------------------------------------------------------------------------------------------
-- Annulation AU NOM DE LA PLATEFORME
-- ---------------------------------------------------------------------------------------------
-- Ni le client ni le salon : quand la plateforme tranche un litige, ça se lit dans le rendez-vous.
-- Sans cette valeur, une annulation d'arbitrage se serait dite « demande expirée » aux deux parties.
alter type public.cancelled_by add value if not exists 'platform';

-- ---------------------------------------------------------------------------------------------
-- Suspension d'un client (toute la place de marché, pas un seul salon)
-- ---------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Masquage d'un avis
-- ---------------------------------------------------------------------------------------------
-- Un avis masqué disparaît de la page publique ET du calcul de la note, mais n'est JAMAIS
-- supprimé : une décision doit pouvoir s'expliquer six mois plus tard.
alter table public.reviews
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_reason text,
  add column if not exists hidden_by uuid references public.profiles (id) on delete set null;

create or replace function public.reviews_refresh_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid := coalesce(new.salon_id, old.salon_id);
begin
  update public.salons s set
    rating_avg = coalesce((
      select round(avg(rating)::numeric, 2) from public.reviews r
      where r.salon_id = v_salon and r.hidden_at is null
    ), 0),
    rating_count = (
      select count(*) from public.reviews r
      where r.salon_id = v_salon and r.hidden_at is null
    )
  where s.id = v_salon;
  return null;
end $$;

-- Remise à niveau immédiate (sans effet aujourd'hui, aucun avis n'est masqué) : la note affichée
-- doit toujours être celle que la nouvelle règle donne, jamais un reste de l'ancienne.
update public.salons s set
  rating_avg = coalesce((
    select round(avg(r.rating)::numeric, 2) from public.reviews r
    where r.salon_id = s.id and r.hidden_at is null
  ), 0),
  rating_count = (
    select count(*) from public.reviews r
    where r.salon_id = s.id and r.hidden_at is null
  );


-- ---------------------------------------------------------------------------------------------
-- Recherche publique : « publié » devient « visible ».
-- ---------------------------------------------------------------------------------------------

create or replace function public.search_salons_v2(
  p_q text default null,
  p_wilaya smallint default null,
  p_city text default null,
  p_category text default null,
  p_gender public.gender_target default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_sort text default 'relevance',
  p_available_today boolean default false,
  p_limit int default 20,
  p_offset int default 0,
  p_rating_min numeric default null
)
returns table (
  id uuid, slug text, name text, city text, zone text, wilaya_code smallint, cover_url text, logo_url text,
  gender_target public.gender_target, rating_avg numeric, rating_count int,
  category_ids text[], min_price_da int, distance_km double precision,
  lat double precision, lng double precision,
  top_services jsonb, next_slots jsonb, next_available jsonb, is_open_now boolean, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select s.*,
      case when p_lat is not null and p_lng is not null and s.lat is not null and s.lng is not null then
        6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(p_lng))
                  + sin(radians(p_lat)) * sin(radians(s.lat))))
      end as dist,
      (select min(sv.price_da) from public.services sv where sv.salon_id = s.id and sv.is_active) as min_price,
      (select min(sv.duration_minutes) from public.services sv where sv.salon_id = s.id and sv.is_active) as min_duration
    from public.salons s
    where s.is_visible
      -- Préfiltre par boîte englobante (indexable) avant le calcul de distance : on ne parcourt que la zone demandée.
      and (p_lat is null or p_lng is null or p_radius_km is null or (
        s.lat between p_lat - p_radius_km / 111.0 and p_lat + p_radius_km / 111.0
        and s.lng between p_lng - p_radius_km / (111.0 * greatest(0.2, cos(radians(p_lat))))
                      and p_lng + p_radius_km / (111.0 * greatest(0.2, cos(radians(p_lat))))))
      and (p_wilaya is null or s.wilaya_code = p_wilaya)
      and (p_city is null or public.f_unaccent(s.city) ilike public.f_unaccent(p_city)
           or public.f_unaccent(coalesce(s.zone, '')) ilike public.f_unaccent(p_city))
      and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
      and (p_category is null or exists (
        select 1 from public.salon_categories sc where sc.salon_id = s.id and sc.category_id = p_category))
      and (p_rating_min is null or (s.rating_count > 0 and s.rating_avg >= p_rating_min))
      and (p_q is null or p_q = ''
        or public.f_unaccent(s.name || ' ' || s.city || ' ' || coalesce(s.zone, '')) ilike '%' || public.f_unaccent(p_q) || '%'
        or exists (select 1 from public.services sv where sv.salon_id = s.id and sv.is_active
                   and public.f_unaccent(sv.name) ilike '%' || public.f_unaccent(p_q) || '%'))
  ),
  -- Plafond de candidats : les disponibilités (coûteuses) ne sont calculées que pour les 200 salons les plus
  -- pertinents de la zone, jamais pour toute une wilaya.
  candidates as (
    select * from base b
    where (p_radius_km is null or b.dist is null or b.dist <= p_radius_km)
    order by (case when p_lat is not null and p_lng is not null and b.lat is not null then 0 else 1 end),
             b.dist asc nulls last, b.rating_avg desc, b.rating_count desc, b.created_at desc
    limit 200
  ),
  enriched as (
    select b.*,
      coalesce((select array_agg(sc.category_id order by sc.category_id)
                from public.salon_categories sc where sc.salon_id = b.id), '{}'::text[]) as cat_ids,
      coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'priceDa', t.price_da) order by t.sort_order)
                from (select sv.name, sv.price_da, sv.sort_order from public.services sv
                      where sv.salon_id = b.id and sv.is_active order by sv.sort_order, sv.created_at limit 3) t),
               '[]'::jsonb) as top_svc,
      public.next_availability(b.id, b.min_duration, 3, 7) as next_avail,
      exists (
        select 1 from public.opening_hours oh
        where oh.salon_id = b.id and not oh.is_closed
          and oh.day_of_week = extract(dow from (now() at time zone 'Africa/Algiers'))::int
          and (now() at time zone 'Africa/Algiers')::time between oh.opens_at and oh.closes_at
      ) as open_now
    from candidates b
  ),
  with_today as (
    select e.*,
      case when e.next_avail is not null and (e.next_avail->>'date') = to_char((now() at time zone 'Africa/Algiers')::date, 'YYYY-MM-DD')
           then e.next_avail->'slots' else '[]'::jsonb end as slots_today
    from enriched e
  ),
  filtered as (
    select * from with_today w
    where (not p_available_today or jsonb_array_length(w.slots_today) > 0)
  )
  select f.id, f.slug, f.name, f.city, f.zone, f.wilaya_code, f.cover_url, f.logo_url, f.gender_target,
         f.rating_avg, f.rating_count, f.cat_ids, f.min_price, f.dist, f.lat, f.lng, f.top_svc, f.slots_today, f.next_avail, f.open_now,
         count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'rating' then -coalesce(f.rating_avg, 0) end asc nulls last,
    case when p_sort = 'price_asc' then f.min_price end asc nulls last,
    case when p_sort = 'price_desc' then -f.min_price end asc nulls last,
    case when p_sort = 'relevance' then (case when jsonb_array_length(f.slots_today) > 0 then 0 when f.next_avail is not null then 1 else 2 end) end asc,
    (case when p_lat is not null and p_lng is not null and f.lat is not null then 0 else 1 end),
    f.dist asc nulls last,
    f.rating_avg desc, f.rating_count desc, f.created_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
$$;

create or replace function public.salon_cities(
  p_wilaya smallint default null,
  p_gender public.gender_target default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_q text default null
)
returns table (city text, parent_city text, wilaya_code smallint, salon_count bigint, distance_km double precision)
language sql stable security definer set search_path = public as $$
  with places as (
    select coalesce(nullif(s.zone, ''), s.city) as place,
           case when nullif(s.zone, '') is not null and s.zone <> s.city then s.city end as parent_city,
           s.wilaya_code, s.lat, s.lng
    from public.salons s
    where s.is_visible
      and (p_wilaya is null or s.wilaya_code = p_wilaya)
      and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
      and (p_q is null or p_q = ''
           or public.f_unaccent(coalesce(s.zone, '')) ilike '%' || public.f_unaccent(p_q) || '%'
           or public.f_unaccent(s.city) ilike '%' || public.f_unaccent(p_q) || '%')
  )
  select p.place as city, max(p.parent_city) as parent_city, p.wilaya_code, count(*) as salon_count,
    case when p_lat is not null and p_lng is not null and avg(p.lat) is not null then
      6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(avg(p.lat))) * cos(radians(avg(p.lng)) - radians(p_lng))
                + sin(radians(p_lat)) * sin(radians(avg(p.lat)))))
    end as distance_km
  from places p
  group by p.place, p.wilaya_code
  order by distance_km asc nulls last, salon_count desc, p.place
  limit 30
$$;

create or replace function public.search_suggest(p_q text, p_gender public.gender_target default null, p_wilaya smallint default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  with needle as (select '%' || public.f_unaccent(coalesce(p_q, '')) || '%' as pat),
  pub as (
    select s.* from public.salons s
    where s.is_visible
      and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
  ),
  salons as (
    select jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'name', s.name, 'city', s.city, 'zone', s.zone, 'wilayaCode', s.wilaya_code,
      'logoUrl', s.logo_url, 'coverUrl', s.cover_url, 'ratingAvg', s.rating_avg, 'ratingCount', s.rating_count,
      'categoryId', (select sc.category_id from public.salon_categories sc where sc.salon_id = s.id order by sc.category_id limit 1)
    ) as j,
    -- même wilaya en premier, puis correspondance au début du nom, puis note
    (case when p_wilaya is not null and s.wilaya_code = p_wilaya then 0 else 1 end) as w,
    (case when public.f_unaccent(s.name) ilike public.f_unaccent(coalesce(p_q, '')) || '%' then 0 else 1 end) as pfx
    from pub s, needle n
    where public.f_unaccent(s.name) ilike n.pat
    order by w, pfx, s.rating_avg desc, s.rating_count desc
    limit 5
  ),
  services as (
    select jsonb_build_object('name', t.name, 'salonCount', t.cnt, 'minPriceDa', t.min_price) as j
    from (
      select initcap(sv.name) as name, count(distinct sv.salon_id) as cnt, min(sv.price_da) as min_price
      from public.services sv join pub s on s.id = sv.salon_id, needle n
      where sv.is_active and public.f_unaccent(sv.name) ilike n.pat
      group by initcap(sv.name)
      order by cnt desc, min_price asc
      limit 5
    ) t
  ),
  places as (
    select jsonb_build_object('city', t.place, 'parentCity', t.parent_city, 'wilayaCode', t.wilaya_code, 'salonCount', t.cnt) as j
    from (
      select coalesce(nullif(s.zone, ''), s.city) as place,
             max(case when nullif(s.zone, '') is not null and s.zone <> s.city then s.city end) as parent_city,
             s.wilaya_code, count(*) as cnt
      from pub s, needle n
      where public.f_unaccent(coalesce(s.zone, '')) ilike n.pat or public.f_unaccent(s.city) ilike n.pat
      group by coalesce(nullif(s.zone, ''), s.city), s.wilaya_code
      order by (case when p_wilaya is not null and s.wilaya_code = p_wilaya then 0 else 1 end), cnt desc
      limit 5
    ) t
  )
  select jsonb_build_object(
    'salons', coalesce((select jsonb_agg(j) from salons), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(j) from services), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(j) from places), '[]'::jsonb)
  )
$$;


-- ---------------------------------------------------------------------------------------------
-- Créneaux, création et report : une suspension arrête ce qui entre.
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_available_slots_for(
  p_salon_id uuid,
  p_duration_minutes int,
  p_date date,
  p_staff_id uuid default null,
  p_enforce_lead_time boolean default true,
  p_exclude_booking uuid default null,
  p_service_ids uuid[] default null
)
returns table (slot_start timestamptz, staff_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_salon public.salons%rowtype;
  v_dow int;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_min_start timestamptz;
  v_duration interval;
  v_step interval;
  v_buffer interval;
begin
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then return; end if;
  -- Salon suspendu par la plateforme (gelé ou masqué) : aucun créneau, pour personne. La
  -- suspension arrête ce qui ENTRE ; elle n'empêche pas de clore ce qui est déjà pris.
  if v_salon.suspended_at is not null then return; end if;
  if p_duration_minutes is null or p_duration_minutes <= 0 then return; end if;

  v_dow := extract(dow from p_date)::int; -- 0 = dimanche
  v_day_start := (p_date::timestamp) at time zone 'Africa/Algiers';
  v_day_end := v_day_start + interval '1 day';
  v_duration := make_interval(mins => p_duration_minutes);
  v_step := make_interval(mins => v_salon.slot_interval_minutes);
  v_buffer := make_interval(mins => coalesce(v_salon.buffer_minutes, 0));
  v_min_start := case when p_enforce_lead_time
    then now() + make_interval(mins => v_salon.booking_lead_time_minutes)
    else now() - interval '1 day' end;

  return query
  with staff_set as (
    select s.id
    from public.staff s
    where s.salon_id = p_salon_id and s.is_active
      and (p_staff_id is null or s.id = p_staff_id)
      and (p_service_ids is null or s.all_services or not exists (
        select 1 from unnest(p_service_ids) as req(service_id)
        where not exists (select 1 from public.staff_services ss where ss.staff_id = s.id and ss.service_id = req.service_id)
      ))
  ),
  windows as (
    -- Membre avec horaires personnalisés : ses plages du jour, bornées par l'ouverture du salon.
    select ss.id as sid,
           greatest(v_day_start + sh.starts_at::interval, v_day_start + oh.opens_at::interval) as win_start,
           least(v_day_start + sh.ends_at::interval, v_day_start + oh.closes_at::interval) as win_end
    from staff_set ss
    join public.staff_hours sh on sh.staff_id = ss.id and sh.day_of_week = v_dow
    join public.opening_hours oh on oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
    where sh.starts_at < oh.closes_at and sh.ends_at > oh.opens_at
    union all
    -- Membre SANS aucun horaire personnalisé : horaires du salon.
    select ss.id,
           v_day_start + oh.opens_at::interval,
           v_day_start + oh.closes_at::interval
    from staff_set ss
    join public.opening_hours oh on oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
    where not exists (select 1 from public.staff_hours sh where sh.staff_id = ss.id)
  ),
  candidates as (
    select w.sid, gs as s_start
    from windows w
    cross join lateral generate_series(w.win_start, w.win_end - v_duration, v_step) as gs
  ),
  busy as (
    select b.staff_id as sid, tstzrange(b.starts_at - v_buffer, b.ends_at + v_buffer, '[)') as r
    from public.bookings b
    where b.salon_id = p_salon_id and b.status in ('pending', 'confirmed')
      and b.starts_at < v_day_end and b.ends_at > v_day_start
      and b.id is distinct from p_exclude_booking
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

create or replace function public.create_booking_multi(
  p_salon_id uuid,
  p_service_ids uuid[],
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
  v_booking public.bookings%rowtype;
  v_total record;
  v_local_date date;
  v_today date;
  v_ends timestamptz;
  v_candidates uuid[];
  v_staff uuid;
  v_status public.booking_status;
  v_dow int;
  v_first uuid;
  v_constraint text;
begin
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'SERVICE_INACTIVE' using errcode = 'P0001';
  end if;
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then
    raise exception 'SALON_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Suspension par la PLATEFORME : elle s'applique aussi à la saisie du salon lui-même, sinon la
  -- porte de derrière annule la décision. Elle ne bloque que la création : confirmer, terminer ou
  -- annuler un rendez-vous déjà pris reste possible, c'est ainsi qu'on solde proprement.
  if v_salon.suspended_at is not null then
    raise exception 'SALON_SUSPENDED' using errcode = 'P0001';
  end if;
  select * into v_total from public.services_total(p_salon_id, p_service_ids);
  if v_total.n <> array_length(p_service_ids, 1) then
    raise exception 'SERVICE_INACTIVE' using errcode = 'P0001';
  end if;
  v_first := p_service_ids[1];

  v_ends := p_starts_at + make_interval(mins => v_total.duration_minutes);
  v_local_date := (p_starts_at at time zone 'Africa/Algiers')::date;
  v_today := (now() at time zone 'Africa/Algiers')::date;
  v_dow := extract(dow from v_local_date)::int;

  if p_enforce_rules then
    if not v_salon.is_published then
      raise exception 'SALON_NOT_PUBLISHED' using errcode = 'P0001';
    end if;
    -- Client suspendu par la plateforme : plus de réservation EN LIGNE, nulle part. Reçu en
    -- personne au salon, il reste l'affaire du salon — d'où la place de ce test, sous les règles.
    if p_client_id is not null and exists (
      select 1 from public.profiles pr where pr.id = p_client_id and pr.suspended_at is not null
    ) then
      raise exception 'CLIENT_SUSPENDED' using errcode = 'P0001';
    end if;
    -- Client bloqué par ce salon (par compte ou par numéro) : pas de réservation en ligne chez lui.
    if exists (
      select 1 from public.blocked_clients bc
      where bc.salon_id = p_salon_id
        and ((p_client_id is not null and bc.client_id = p_client_id)
             or (p_client_phone is not null and bc.phone = p_client_phone))
    ) then
      raise exception 'CLIENT_BLOCKED' using errcode = 'P0001';
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
    from public.get_available_slots_for(p_salon_id, v_total.duration_minutes, v_local_date, p_staff_id, true, null, p_service_ids) a
    join public.staff st on st.id = a.staff_id
    where a.slot_start = p_starts_at;

    if v_candidates is null then
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
    select array[s.id] into v_candidates from public.staff s
      where s.id = p_staff_id and s.salon_id = p_salon_id and s.is_active
        and (s.all_services or not exists (
          select 1 from unnest(p_service_ids) as req(service_id)
          where not exists (select 1 from public.staff_services ss where ss.staff_id = s.id and ss.service_id = req.service_id)));
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
        p_salon_id, p_client_id, v_staff, v_first, v_total.label, v_total.duration_minutes,
        v_total.price_da, p_starts_at, v_ends, v_status, p_source, p_client_name, p_client_phone, p_notes
      )
      returning * into v_booking;

      insert into public.booking_items (booking_id, service_id, service_name, duration_minutes, price_da, sort_order)
      select v_booking.id, sv.id, sv.name, sv.duration_minutes, sv.price_da, ord.i
      from unnest(p_service_ids) with ordinality as ord(id, i)
      join public.services sv on sv.id = ord.id;

      return v_booking;
    exception when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_client_no_overlap' then
        raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
      end if;
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;

  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;

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
  v_today date;
  v_candidates uuid[];
  v_staff uuid;
  v_ends timestamptz;
  v_service_ids uuid[];
  v_constraint text;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_b.status not in ('pending', 'confirmed') then
    raise exception 'BOOKING_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;
  select * into v_salon from public.salons where id = v_b.salon_id;
  if v_salon.suspended_at is not null then
    raise exception 'SALON_SUSPENDED' using errcode = 'P0001';
  end if;
  v_ends := p_starts_at + make_interval(mins => v_b.duration_minutes);
  v_local_date := (p_starts_at at time zone 'Africa/Algiers')::date;
  v_today := (now() at time zone 'Africa/Algiers')::date;

  if p_enforce_rules then
    -- Règles côté client : report autorisé, délai (même règle que l'annulation), délai minimum, horizon.
    if not v_salon.allow_client_reschedule then
      raise exception 'RESCHEDULE_DISABLED' using errcode = 'P0001';
    end if;
    if now() > v_b.starts_at - make_interval(hours => v_salon.cancel_min_hours::int) then
      raise exception 'CANCEL_TOO_LATE' using errcode = 'P0001';
    end if;
    if p_starts_at < now() + make_interval(mins => v_salon.booking_lead_time_minutes) then
      raise exception 'TOO_SOON' using errcode = 'P0001';
    end if;
    if v_local_date > v_today + v_salon.booking_horizon_days then
      raise exception 'TOO_FAR' using errcode = 'P0001';
    end if;
    -- Un seul report en ligne par rendez-vous : au-delà, le client contacte le salon (anti-abus).
    if v_b.client_reschedules >= 1 then
      raise exception 'RESCHEDULE_LIMIT' using errcode = 'P0001';
    end if;
    if p_staff_id is not null and not exists (
      select 1 from public.staff where id = p_staff_id and salon_id = v_b.salon_id and is_active
    ) then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;
    -- Durée totale de la réservation (prestations cumulées), en ignorant la réservation déplacée.
    select coalesce(array_agg(bi.service_id order by bi.sort_order), array[v_b.service_id]) into v_service_ids
    from public.booking_items bi where bi.booking_id = v_b.id and bi.service_id is not null;
    select array_agg(a.staff_id order by (a.staff_id = v_b.staff_id) desc, st.sort_order, st.created_at) into v_candidates
    from public.get_available_slots_for(v_b.salon_id, v_b.duration_minutes, v_local_date, p_staff_id, true, v_b.id, v_service_ids) a
    join public.staff st on st.id = a.staff_id
    where a.slot_start = p_starts_at;
    if v_candidates is null then raise exception 'SLOT_TAKEN' using errcode = 'P0001'; end if;
  else
    -- Report par le professionnel : membre du salon obligatoire, pas de délai.
    v_staff := coalesce(p_staff_id, v_b.staff_id);
    if not exists (select 1 from public.staff where id = v_staff and salon_id = v_b.salon_id) then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;
    v_candidates := array[v_staff];
  end if;

  -- Une seule mise à jour : la contrainte d'exclusion ignore l'ancienne version de la ligne,
  -- et le trigger de notifications voit un simple changement d'horaire (« Réservation déplacée »).
  foreach v_staff in array v_candidates loop
    begin
      update public.bookings
        set starts_at = p_starts_at, ends_at = v_ends, staff_id = v_staff,
            client_reschedules = client_reschedules + (case when p_enforce_rules then 1 else 0 end)
        where id = p_booking_id
        returning * into v_b;
      return v_b;
    exception when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_client_no_overlap' then
        raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
      end if;
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;
  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;


-- ---------------------------------------------------------------------------------------------
-- Les listes d'administration disent qui est suspendu, sans ouvrir chaque fiche.
-- ---------------------------------------------------------------------------------------------

drop function if exists public.admin_salons_page(text, text, smallint, int, int);

create or replace function public.admin_salons_page(
  p_q text default null,
  p_status text default null,   -- 'published' | 'draft'
  p_wilaya smallint default null,
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  id uuid, slug text, name text, city text, wilaya_code smallint, gender_target public.gender_target,
  is_published boolean, created_at timestamptz,
  suspended_at timestamptz, suspension_level public.suspension_level, suspended_reason text,
  owner_id uuid, owner_name text, owner_phone text, owner_email text,
  services_count bigint, staff_count bigint,
  bookings_30 bigint, revenue_30 bigint, cancelled_30 bigint, no_show_30 bigint,
  last_booking_at timestamptz, rating_avg numeric, rating_count int,
  total_count bigint
)
language sql stable security definer set search_path = public as $$
  with f as (
    select s.* from public.salons s
    where (p_status is null
           or (p_status = 'published' and s.is_published)
           or (p_status = 'draft' and not s.is_published))
      and (p_wilaya is null or s.wilaya_code = p_wilaya)
      and (p_q is null or p_q = ''
           or public.f_unaccent(s.name || ' ' || s.city || ' ' || s.slug) ilike '%' || public.f_unaccent(p_q) || '%'
           or exists (select 1 from public.profiles pr where pr.id = s.owner_id
                      and (coalesce(pr.phone, '') like '%' || p_q || '%'
                           or public.f_unaccent(coalesce(pr.full_name, '')) ilike '%' || public.f_unaccent(p_q) || '%')))
  )
  select f.id, f.slug, f.name, f.city, f.wilaya_code, f.gender_target, f.is_published, f.created_at,
    f.suspended_at, f.suspension_level, f.suspended_reason,
    f.owner_id,
    (select pr.full_name from public.profiles pr where pr.id = f.owner_id),
    (select pr.phone from public.profiles pr where pr.id = f.owner_id),
    (select u.email from auth.users u where u.id = f.owner_id),
    (select count(*) from public.services sv where sv.salon_id = f.id and sv.is_active),
    (select count(*) from public.staff st where st.salon_id = f.id and st.is_active),
    (select count(*) from public.bookings b where b.salon_id = f.id and b.created_at >= now() - interval '30 days'),
    (select coalesce(sum(b.price_da), 0)::bigint from public.bookings b
      where b.salon_id = f.id and b.status = 'completed' and b.starts_at >= now() - interval '30 days'),
    (select count(*) from public.bookings b where b.salon_id = f.id and b.status = 'cancelled' and b.created_at >= now() - interval '30 days'),
    (select count(*) from public.bookings b where b.salon_id = f.id and b.status = 'no_show' and b.starts_at >= now() - interval '30 days'),
    (select max(b.created_at) from public.bookings b where b.salon_id = f.id),
    f.rating_avg, f.rating_count,
    count(*) over ()
  from f
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100)) offset greatest(0, coalesce(p_offset, 0))
$$;

drop function if exists public.admin_profiles_page(text, text, int, int);

create or replace function public.admin_profiles_page(
  p_q text default null,
  p_role text default null,     -- 'client' | 'pro'
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  id uuid, role public.user_role, full_name text, phone text, email text, avatar_url text,
  market text, created_at timestamptz, suspended_at timestamptz, suspended_reason text,
  bookings_count bigint, cancelled_count bigint, no_show_count bigint,
  reviews_count bigint, blocked_by bigint, last_booking_at timestamptz,
  salon_id uuid, salon_name text,
  total_count bigint
)
language sql stable security definer set search_path = public as $$
  with f as (
    select p.* from public.profiles p
    where (p_role is null or p.role::text = p_role)
      and (p_q is null or p_q = ''
           or public.f_unaccent(coalesce(p.full_name, '')) ilike '%' || public.f_unaccent(p_q) || '%'
           or coalesce(p.phone, '') like '%' || regexp_replace(p_q, '\s', '', 'g') || '%'
           or exists (select 1 from auth.users u where u.id = p.id and u.email ilike '%' || p_q || '%'))
  )
  select f.id, f.role, f.full_name, f.phone,
    (select u.email from auth.users u where u.id = f.id),
    f.avatar_url, f.market, f.created_at, f.suspended_at, f.suspended_reason,
    (select count(*) from public.bookings b where b.client_id = f.id),
    (select count(*) from public.bookings b where b.client_id = f.id and b.status = 'cancelled' and b.cancelled_by = 'client'),
    (select count(*) from public.bookings b where b.client_id = f.id and b.status = 'no_show'),
    (select count(*) from public.reviews r where r.client_id = f.id),
    (select count(*) from public.blocked_clients bc where bc.client_id = f.id),
    (select max(b.starts_at) from public.bookings b where b.client_id = f.id),
    (select s.id from public.salons s where s.owner_id = f.id order by s.created_at limit 1),
    (select s.name from public.salons s where s.owner_id = f.id order by s.created_at limit 1),
    count(*) over ()
  from f
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100)) offset greatest(0, coalesce(p_offset, 0))
$$;


-- ---------------------------------------------------------------------------------------------
-- Droits : ces colonnes ne concernent que l'API (clé secrète) et l'administration.
-- La migration 0039 a révoqué le select de table et accordé colonne par colonne ; une colonne
-- ajoutée n'est donc lisible par personne d'autre, ce qui est exactement ce qu'on veut.
-- `is_visible` fait exception : elle remplace `is_published` dans les lectures publiques.
-- ---------------------------------------------------------------------------------------------
grant select (is_visible) on public.salons to anon, authenticated;
