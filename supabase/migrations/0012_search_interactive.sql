-- 0012 — Recherche interactive : lieux (quartiers + villes, toutes wilayas), suggestions typées
-- (salons / prestations / lieux) et filtre « note minimale » sur la marketplace.

-- ---------------------------------------------------------------------
-- 1) Lieux : un quartier (zone) ou une ville, avec sa ville parente et sa wilaya.
--    Sans p_wilaya, la recherche couvre tout le pays (recherche par ville).
-- ---------------------------------------------------------------------
drop function if exists public.salon_cities(smallint, public.gender_target, double precision, double precision, text);

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
    where s.is_published
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
grant execute on function public.salon_cities(smallint, public.gender_target, double precision, double precision, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Suggestions de recherche : salons, prestations, lieux — en une requête.
-- ---------------------------------------------------------------------
create or replace function public.search_suggest(p_q text, p_gender public.gender_target default null, p_wilaya smallint default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  with needle as (select '%' || public.f_unaccent(coalesce(p_q, '')) || '%' as pat),
  pub as (
    select s.* from public.salons s
    where s.is_published
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
grant execute on function public.search_suggest(text, public.gender_target, smallint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Marketplace : filtre note minimale (« Note 4,5+ »).
-- ---------------------------------------------------------------------
drop function if exists public.search_salons_v2(text, smallint, text, text, public.gender_target, double precision, double precision, double precision, text, boolean, int, int);

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
    from base b
    where (p_radius_km is null or b.dist is null or b.dist <= p_radius_km)
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
