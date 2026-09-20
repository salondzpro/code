-- 0044 — Administration de la place de marché, lot 1 : QUI peut agir, et la TRACE de ce qu'il fait.
--
-- Conception dans `docs/ADMIN.md`. Deux décisions sont matérialisées ici :
--
--   • l'administrateur n'est PAS un type d'utilisateur de la place de marché. Il reste un compte
--     client ou pro ordinaire, inscrit dans une table à part. On donne et on retire un accès sans
--     toucher au compte, et un accès retiré ne laisse pas un rôle orphelin derrière lui ;
--   • deux niveaux, parce que le jour où quelqu'un aide au support il ne doit pas pouvoir effacer
--     un salon par erreur : `support` répare, `owner` fait tout.
--
-- Le lot 1 ne modifie RIEN dans la place de marché : il ne fait que lire. Les colonnes de
-- suspension et de modération viendront avec le lot 2, là où elles servent — pas de colonne morte.

create type public.admin_level as enum ('support', 'owner');

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  level public.admin_level not null default 'support',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  /** Accès retiré : on garde la ligne, elle explique le journal laissé derrière. */
  disabled_at timestamptz
);
-- RLS active SANS aucune policy : la table est illisible avec la clé publique, quel que soit le
-- compte. Seule l'API (clé secrète) y accède.
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

/**
 * Journal des actions d'administration. Un opérateur agit sur les données d'autrui : chaque
 * écriture est tracée avec l'état avant et après, son motif et l'adresse d'où elle vient. C'est
 * ce qui permet de répondre à « pourquoi mon salon a-t-il été suspendu ? » six mois plus tard.
 * En lot 1, seules les consultations sensibles y écrivent ; le lot 2 y écrira les actions.
 */
create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  reason text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_recent_idx on public.admin_audit (created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target_type, target_id, created_at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- ---------------------------------------------------------------------
-- Tableau de bord : tout en UNE requête. Dix allers-retours pour une page d'accueil,
-- c'est une page d'accueil qu'on n'ouvre plus.
-- ---------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language sql stable security definer set search_path = public as $$
  with
  j as (select (now() at time zone 'Africa/Algiers')::date as jour),
  jour_debut as (select ((select jour from j)::timestamp at time zone 'Africa/Algiers') as d),
  b30 as (
    select * from public.bookings where created_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
      'bookings',  (select count(*) from public.bookings where created_at >= (select d from jour_debut)),
      'cancelled', (select count(*) from public.bookings where cancelled_at >= (select d from jour_debut)),
      'noShows',   (select count(*) from public.bookings where status = 'no_show' and starts_at >= (select d from jour_debut)),
      'salons',    (select count(*) from public.salons where created_at >= (select d from jour_debut)),
      'signups',   (select count(*) from public.profiles where created_at >= (select d from jour_debut))
    ),
    'last30', jsonb_build_object(
      'bookings',   (select count(*) from b30),
      'revenueDa',  (select coalesce(sum(price_da), 0)::bigint from b30 where status = 'completed'),
      'cancelRate', (select case when count(*) = 0 then 0
                       else round(100.0 * count(*) filter (where status = 'cancelled') / count(*)) end from b30),
      'noShowRate', (select case when count(*) = 0 then 0
                       else round(100.0 * count(*) filter (where status = 'no_show') / count(*)) end from b30)
    ),
    'marketplace', jsonb_build_object(
      'salons',          (select count(*) from public.salons),
      'salonsPublished', (select count(*) from public.salons where is_published),
      'services',        (select count(*) from public.services where is_active),
      'pros',            (select count(*) from public.profiles where role = 'pro'),
      'clients',         (select count(*) from public.profiles where role = 'client'),
      'reviews',         (select count(*) from public.reviews),
      'reviewsNoReply',  (select count(*) from public.reviews where reply is null)
    ),
    'health', jsonb_build_object(
      'lastCronTick',    (select value from public.app_settings where key = 'cron_last_tick'),
      'lastBookingAt',   (select max(created_at) from public.bookings),
      'pendingOverdue',  (select count(*) from public.bookings where status = 'pending' and starts_at < now())
    )
  )
$$;
revoke execute on function public.admin_overview() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Liste des professionnels, avec ce qu'on demande au téléphone : l'activité.
-- ---------------------------------------------------------------------
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
revoke execute on function public.admin_salons_page(text, text, smallint, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Liste des comptes (clients et professionnels).
-- ---------------------------------------------------------------------
create or replace function public.admin_profiles_page(
  p_q text default null,
  p_role text default null,     -- 'client' | 'pro'
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  id uuid, role public.user_role, full_name text, phone text, email text, avatar_url text,
  market text, created_at timestamptz,
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
    f.avatar_url, f.market, f.created_at,
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
revoke execute on function public.admin_profiles_page(text, text, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Recherche globale de rendez-vous : l'outil du litige.
-- ---------------------------------------------------------------------
create or replace function public.admin_bookings_page(
  p_q text default null,
  p_status public.booking_status default null,
  p_from date default null,
  p_to date default null,
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, status public.booking_status,
  service_name text, price_da int, source public.booking_source,
  client_name text, client_phone text, client_id uuid,
  salon_id uuid, salon_name text, salon_slug text, staff_name text,
  cancelled_at timestamptz, cancelled_by public.cancelled_by, cancellation_reason text,
  created_at timestamptz,
  total_count bigint
)
language sql stable security definer set search_path = public as $$
  with f as (
    select b.* from public.bookings b
    where (p_status is null or b.status = p_status)
      and (p_from is null or b.starts_at >= (p_from::timestamp at time zone 'Africa/Algiers'))
      and (p_to is null or b.starts_at < ((p_to + 1)::timestamp at time zone 'Africa/Algiers'))
      and (p_q is null or p_q = ''
           or public.f_unaccent(b.client_name) ilike '%' || public.f_unaccent(p_q) || '%'
           or coalesce(b.client_phone, '') like '%' || regexp_replace(p_q, '\s', '', 'g') || '%'
           or exists (select 1 from public.salons s where s.id = b.salon_id
                      and public.f_unaccent(s.name) ilike '%' || public.f_unaccent(p_q) || '%'))
  )
  select f.id, f.starts_at, f.ends_at, f.status, f.service_name, f.price_da, f.source,
    f.client_name, f.client_phone, f.client_id,
    f.salon_id,
    (select s.name from public.salons s where s.id = f.salon_id),
    (select s.slug from public.salons s where s.id = f.salon_id),
    (select st.display_name from public.staff st where st.id = f.staff_id),
    f.cancelled_at, f.cancelled_by, f.cancellation_reason, f.created_at,
    count(*) over ()
  from f
  order by f.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100)) offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function public.admin_bookings_page(text, public.booking_status, date, date, int, int) from public, anon, authenticated;
