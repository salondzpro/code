-- Recherche de salons : le RAYON prime sur le nom de la commune.
--
-- Défaut constaté le 30 septembre 2026 : en se plaçant sur « Akbou » (Béjaïa), la place de marché
-- n'affichait que les salons dont la colonne `city` vaut exactement « Akbou ». Le front envoie
-- pourtant la ville ET les coordonnées, et la fonction les combinait en ET : le nom l'emportait et
-- le rayon ne servait plus à rien. Un salon à deux kilomètres, ou dont la commune est écrite
-- autrement, restait invisible.
--
-- Règle : quand on dispose de coordonnées ET d'un rayon, on ne filtre QUE par la distance. Le nom
-- de commune et la wilaya ne reprennent leur rôle que pour une recherche sans position.

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
  with reperes as (
    -- Vrai dès qu'on sait OÙ l'on est : coordonnées complètes et rayon. C'est ce cas qui doit
    -- s'appuyer sur la distance réelle, et sur elle seule.
    select (p_lat is not null and p_lng is not null and p_radius_km is not null) as p_situe
  ),
  base as (
    select s.*,
      case when p_lat is not null and p_lng is not null and s.lat is not null and s.lng is not null then
        6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(p_lng))
                  + sin(radians(p_lat)) * sin(radians(s.lat))))
      end as dist,
      (select min(sv.price_da) from public.services sv where sv.salon_id = s.id and sv.is_active) as min_price,
      (select min(sv.duration_minutes) from public.services sv where sv.salon_id = s.id and sv.is_active) as min_duration
    from public.salons s, reperes
    where s.is_visible
      -- Préfiltre par boîte englobante (indexable) avant le calcul de distance : on ne parcourt que la zone demandée.
      and (p_lat is null or p_lng is null or p_radius_km is null or (
        s.lat between p_lat - p_radius_km / 111.0 and p_lat + p_radius_km / 111.0
        and s.lng between p_lng - p_radius_km / (111.0 * greatest(0.2, cos(radians(p_lat))))
                      and p_lng + p_radius_km / (111.0 * greatest(0.2, cos(radians(p_lat))))))
      -- LE RAYON EST LE LIEU. Quand des coordonnées et un rayon sont donnés, le nom de la commune
      -- ne filtre plus : il rejetait tout salon dont la commune s'écrit autrement, y compris à
      -- deux kilomètres. Choisir « Akbou » sur la carte ne montrait donc que les salons dont le
      -- champ `city` valait EXACTEMENT « Akbou » — ni ceux de la périphérie, ni « Akbou Centre ».
      -- Sans coordonnées (recherche par nom de ville seule), les deux filtres reprennent leur rôle.
      and (p_situe or p_wilaya is null or s.wilaya_code = p_wilaya)
      and (p_situe or p_city is null or public.f_unaccent(s.city) ilike public.f_unaccent(p_city)
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
