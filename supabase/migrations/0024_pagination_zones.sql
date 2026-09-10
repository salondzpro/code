-- 0024 — Pagination et recherche par zone (pas de « tout charger ») :
-- 1) Recherche marketplace / carte : préfiltre par boîte englobante indexée quand un rayon est demandé, puis
--    plafond de 200 candidats avant le calcul (coûteux) des disponibilités ; pagination limit/offset inchangée.
-- 2) Clients du salon : fonction paginée et filtrée côté serveur (`salon_clients_page`), avec total et nombre
--    de bloqués ; `p_key` pour charger une seule fiche.
-- 3) Historique d'un client : limit / offset.
create index if not exists salons_published_geo_idx on public.salons (lat, lng) where is_published;

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
    where s.is_published
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
grant execute on function public.search_salons_v2(text, smallint, text, text, public.gender_target, double precision, double precision, double precision, text, boolean, int, int, numeric) to anon, authenticated;

create or replace function public.salon_clients_page(p_salon_id uuid, p_q text default null, p_key text default null, p_limit int default 30, p_offset int default 0)
returns table (
  client_key text, client_id uuid, name text, phone text, email text,
  bookings_count bigint, completed_count bigint, cancelled_count bigint, no_show_count bigint, spent_da bigint,
  last_at timestamptz, next_at timestamptz, last_booking_id uuid, blocked boolean, blocked_reason text, notes text,
  total_count bigint, blocked_count bigint
)
language sql stable security definer set search_path = public as $$
  with b as (
    select bk.*, coalesce(bk.client_id::text, bk.client_phone, lower(bk.client_name)) as ckey
    from public.bookings bk
    where bk.salon_id = p_salon_id
  ),
  agg as (
    select ckey,
      (array_agg(client_id) filter (where client_id is not null))[1] as client_id,
      (array_agg(client_name order by created_at desc))[1] as name,
      (array_agg(client_phone) filter (where client_phone is not null))[1] as phone,
      count(*) filter (where status <> 'cancelled') as bookings_count,
      count(*) filter (where status = 'completed') as completed_count,
      count(*) filter (where status = 'cancelled' and cancellation_kind is null) as cancelled_count,
      count(*) filter (where status = 'no_show' or (status = 'cancelled' and cancellation_kind = 'late')) as no_show_count,
      coalesce(sum(price_da) filter (where status = 'completed'), 0)::bigint as spent_da,
      max(starts_at) filter (where starts_at <= now() and status <> 'cancelled') as last_at,
      min(starts_at) filter (where starts_at > now() and status in ('pending', 'confirmed')) as next_at,
      (array_agg(id order by (starts_at <= now()) desc, starts_at desc))[1] as last_booking_id
    from b group by ckey
  )
  select a.ckey, a.client_id, a.name, a.phone,
    (select u.email from auth.users u where u.id = a.client_id and u.email not like '%@salondz.test') as email,
    a.bookings_count, a.completed_count, a.cancelled_count, a.no_show_count, a.spent_da,
    a.last_at, a.next_at, a.last_booking_id,
    exists (select 1 from public.blocked_clients bc where bc.salon_id = p_salon_id
            and ((a.client_id is not null and bc.client_id = a.client_id) or (a.phone is not null and bc.phone = a.phone))) as blocked,
    (select bc.reason from public.blocked_clients bc where bc.salon_id = p_salon_id
            and ((a.client_id is not null and bc.client_id = a.client_id) or (a.phone is not null and bc.phone = a.phone)) limit 1) as blocked_reason,
    (select n.notes from public.client_notes n where n.salon_id = p_salon_id and n.client_key = a.ckey) as notes,
    count(*) over () as total_count,
    count(*) filter (where exists (select 1 from public.blocked_clients bc where bc.salon_id = p_salon_id
            and ((a.client_id is not null and bc.client_id = a.client_id) or (a.phone is not null and bc.phone = a.phone)))) over () as blocked_count
  from agg a
  where (p_key is null or a.ckey = p_key)
    and (p_q is null or p_q = ''
         or public.f_unaccent(a.name) ilike '%' || public.f_unaccent(p_q) || '%'
         or coalesce(a.phone, '') like '%' || regexp_replace(p_q, '\s', '', 'g') || '%')
  order by coalesce(a.next_at, a.last_at) desc nulls last, a.name
  limit greatest(1, least(coalesce(p_limit, 30), 100)) offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function public.salon_clients_page(uuid, text, text, int, int) from public, anon, authenticated;

drop function if exists public.salon_client_history(uuid, text);
create or replace function public.salon_client_history(p_salon_id uuid, p_client_key text, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, service_name text, price_da int,
  status public.booking_status, cancelled_by public.cancelled_by, staff_name text
)
language sql stable security definer set search_path = public as $$
  select bk.id, bk.starts_at, bk.ends_at, bk.service_name, bk.price_da, bk.status, bk.cancelled_by, st.display_name
  from public.bookings bk
  left join public.staff st on st.id = bk.staff_id
  where bk.salon_id = p_salon_id
    and coalesce(bk.client_id::text, bk.client_phone, lower(bk.client_name)) = p_client_key
  order by bk.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function public.salon_client_history(uuid, text, int, int) from public, anon, authenticated;
