-- HOMMES ET FEMMES NE SE MÉLANGENT PAS (26 nov. 2026, demande du propriétaire).
-- Un salon MIXTE apparaît des deux côtés, mais avec TOUTES ses prestations : côté Femmes, la recherche
-- proposait « Coupe homme · 1 salon » et retrouvait le salon mixte en tapant « barbe ». Désormais
-- chaque prestation a un côté — celui de sa catégorie, sinon celui que dit son nom (homme, barbe,
-- rasage… / femme, vernis, cils, brushing…), sinon les deux — et la recherche, les suggestions et
-- les prestations affichées sur les cartes ne gardent que celles du côté consulté. Les catégories
-- suggérées sont celles du côté consulté (`categories.market`).

create or replace function public.search_service_side(p_name text, p_category text, p_side public.gender_target)
returns boolean language sql stable set search_path = public, extensions as $$
  select case
    when p_side is null or p_side::text not in ('men', 'women') then true
    else coalesce(
      (select c.market::text from public.categories c where c.id = p_category),
      case
        when public.search_flat(p_name) ~ '(^| )(homme|hommes|barbe|barbier|rasage|degrade|fade|moustache|رجال|لحية)( |$)' then 'men'
        when public.search_flat(p_name) ~ '(^| )(femme|femmes|vernis|ongle|ongles|cils|sourcils|maquillage|brushing|manucure|pedicure|mariee|chignon|epilation|nail|نساء|عروس)( |$)' then 'women'
      end,
      p_side::text
    ) = p_side::text
  end
$$;
revoke execute on function public.search_service_side(text, text, public.gender_target) from public, anon, authenticated;

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
language sql stable security definer set search_path = public, extensions as $$
  with reperes as (
    select (p_lat is not null and p_lng is not null and p_radius_km is not null) as p_situe,
           (coalesce(public.search_flat(p_q), '') <> '') as p_texte
  ),
  zone as (
    select s.*,
      case when p_lat is not null and p_lng is not null and s.lat is not null and s.lng is not null then
        6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(p_lng))
                  + sin(radians(p_lat)) * sin(radians(s.lat))))
      end as dist,
      coalesce((select array_agg(sc.category_id order by sc.category_id)
                from public.salon_categories sc where sc.salon_id = s.id), '{}'::text[]) as cat_ids0
    from public.salons s, reperes
    where s.is_visible
      and (p_lat is null or p_lng is null or p_radius_km is null or (
        s.lat between p_lat - p_radius_km / 111.0 and p_lat + p_radius_km / 111.0
        and s.lng between p_lng - p_radius_km / (111.0 * greatest(0.2, cos(radians(p_lat))))
                      and p_lng + p_radius_km / (111.0 * greatest(0.2, cos(radians(p_lat))))))
      and (p_situe or p_wilaya is null or s.wilaya_code = p_wilaya)
      and (p_situe or p_city is null or public.f_unaccent(s.city) ilike public.f_unaccent(p_city)
           or public.f_unaccent(coalesce(s.zone, '')) ilike public.f_unaccent(p_city))
      and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
      and (p_category is null or exists (
        select 1 from public.salon_categories sc where sc.salon_id = s.id and sc.category_id = p_category))
      and (p_rating_min is null or (s.rating_count > 0 and s.rating_avg >= p_rating_min))
  ),
  base as (
    select z.*,
      (select min(sv.price_da) from public.services sv where sv.salon_id = z.id and sv.is_active) as min_price,
      (select min(sv.duration_minutes) from public.services sv where sv.salon_id = z.id and sv.is_active) as min_duration,
      case when r.p_texte then public.search_text_score(
        z.name,
        concat_ws(' ', z.city, z.zone,
          (select string_agg(sv.name, ' ') from public.services sv where sv.salon_id = z.id and sv.is_active
             and public.search_service_side(sv.name, sv.category_id, p_gender)),
          (select string_agg(c.label_fr || ' ' || coalesce(c.label_ar, ''), ' ')
             from public.categories c where c.id = any (z.cat_ids0) and (p_gender is null or c.market::text = p_gender::text))),
        (select coalesce(array_agg(c.id), '{}'::text[]) from public.categories c
          where c.id = any (z.cat_ids0) and (p_gender is null or c.market::text = p_gender::text)), p_q) else 1 end as txt
    from zone z, reperes r
  ),
  -- Candidats : les plus pertinents puis les plus proches, avant le calcul (coûteux) des créneaux.
  candidates as (
    select * from base b
    where b.txt > 0
      and (p_radius_km is null or b.dist is null or b.dist <= p_radius_km)
    order by b.txt desc,
             (case when p_lat is not null and p_lng is not null and b.lat is not null then 0 else 1 end),
             b.dist asc nulls last, b.rating_avg desc, b.rating_count desc, b.created_at desc
    limit 200
  ),
  enriched as (
    select b.*,
      coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'priceDa', t.price_da) order by t.sort_order)
                from (select sv.name, sv.price_da, sv.sort_order from public.services sv
                      where sv.salon_id = b.id and sv.is_active and public.search_service_side(sv.name, sv.category_id, p_gender)
                      order by sv.sort_order, sv.created_at limit 3) t),
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
  scored as (
    select w.*,
      -- Pertinence façon place de marché mûre : chaque signal entre 0 et 1, pondéré.
      (case when r.p_texte then 0.45 * least(w.txt, 1.3) / 1.3 else 0 end)
      -- Proximité : décroissance exponentielle (moitié du poids à ~0,7 × l'échelle).
      + (case when r.p_texte then 0.20 else 0.30 end)
        * (case when w.dist is null then 0.4
                else exp(-w.dist / greatest(coalesce(p_radius_km, 10) / 2.0, 1.5)) end)
      -- Qualité : note bayésienne (a priori 4,0 pour 3 avis), ramenée sur 1.
      + (case when r.p_texte then 0.15 else 0.25 end)
        * ((coalesce(w.rating_avg, 0) * coalesce(w.rating_count, 0) + 4.0 * 3) / (coalesce(w.rating_count, 0) + 3) / 5.0)
      -- Disponibilité : aujourd'hui, sinon dans la semaine.
      + (case when r.p_texte then 0.15 else 0.35 end)
        * (case when jsonb_array_length(w.slots_today) > 0 then 1 when w.next_avail is not null then 0.5 else 0 end)
      + 0.05 * (case when w.open_now then 1 else 0 end)
      as score
    from with_today w, reperes r
    where (not p_available_today or jsonb_array_length(w.slots_today) > 0)
  )
  select f.id, f.slug, f.name, f.city, f.zone, f.wilaya_code, f.cover_url, f.logo_url, f.gender_target,
         f.rating_avg, f.rating_count, f.cat_ids0, f.min_price, f.dist, f.lat, f.lng, f.top_svc, f.slots_today, f.next_avail, f.open_now,
         count(*) over () as total_count
  from scored f
  order by
    case when p_sort = 'rating' then -coalesce(f.rating_avg, 0) end asc nulls last,
    case when p_sort = 'price_asc' then f.min_price end asc nulls last,
    case when p_sort = 'price_desc' then -f.min_price end asc nulls last,
    case when p_sort = 'distance' then f.dist end asc nulls last,
    case when p_sort = 'relevance' or p_sort is null then -f.score end asc,
    f.dist asc nulls last,
    f.rating_avg desc, f.rating_count desc, f.created_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
$$;

create or replace function public.search_suggest(
  p_q text,
  p_gender public.gender_target default null,
  p_wilaya smallint default null,
  p_city text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_category text default null,
  p_rating_min numeric default null,
  p_available_today boolean default false
)
returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with q as (select public.search_flat(p_q) as qq),
  -- Tous les salons du marché, et ceux du PÉRIMÈTRE des résultats (`dedans`) — mêmes règles que
  -- `search_salons_v2` : rayon autour d'un point s'il y en a un, sinon wilaya et commune ; plus
  -- prestation choisie, note minimale et « disponible aujourd'hui ».
  tous as (
    select s.*,
      case when p_lat is not null and p_lng is not null and p_radius_km is not null then
        s.lat is not null and s.lng is not null
        and 6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(p_lng))
                        + sin(radians(p_lat)) * sin(radians(s.lat)))) <= p_radius_km
      else
        (p_wilaya is null or s.wilaya_code = p_wilaya)
        and (p_city is null or public.f_unaccent(s.city) ilike public.f_unaccent(p_city)
             or public.f_unaccent(coalesce(s.zone, '')) ilike public.f_unaccent(p_city))
      end
      and (p_category is null or exists (
        select 1 from public.salon_categories sc where sc.salon_id = s.id and sc.category_id = p_category))
      and (p_rating_min is null or (s.rating_count > 0 and s.rating_avg >= p_rating_min))
      and (not coalesce(p_available_today, false) or (public.next_availability(s.id,
            (select min(sv.duration_minutes) from public.services sv where sv.salon_id = s.id and sv.is_active), 3, 7)->>'date')
            = to_char((now() at time zone 'Africa/Algiers')::date, 'YYYY-MM-DD'))
        as dedans
    from public.salons s
    where s.is_visible
      and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
  ),
  -- Catégories et prestations mènent à la LISTE des résultats : elles ne comptent que le périmètre.
  pub as (select * from tous where dedans),
  mots as (
    select w from q, regexp_split_to_table(q.qq, ' ') w
    where length(w) >= 2 and not public.search_is_stopword(w)
  ),
  cats_vues as (
    select distinct unnest(public.search_word_categories(w)) as cid from mots
  ),
  categories as (
    select jsonb_build_object('id', c.id, 'label', c.label_fr, 'salonCount', t.cnt) as j, t.cnt, c.sort_order
    from public.categories c
    join lateral (
      select count(distinct sc.salon_id) as cnt from public.salon_categories sc join pub s on s.id = sc.salon_id
      where sc.category_id = c.id
    ) t on true, q
    where t.cnt > 0
      and (p_gender is null or c.market::text = p_gender::text)
      and (c.id in (select cid from cats_vues)
           or public.search_flat(c.label_fr) like q.qq || '%'
           or public.search_flat(c.label_fr) like '% ' || q.qq || '%'
           or coalesce(c.label_ar, '') like q.qq || '%'
           or (length(q.qq) >= 4 and word_similarity(q.qq, public.search_flat(c.label_fr)) >= 0.55))
    order by t.cnt desc, c.sort_order
    limit 3
  ),
  -- Salons : par leur nom D'ABORD, puis par ce qu'ils font (prestations, catégories, synonymes,
  -- fautes tolérées) — « coif » propose les salons qui coiffent, pas seulement « Salon Ali coiff ».
  salons as (
    select jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'name', s.name, 'city', s.city, 'zone', s.zone, 'wilayaCode', s.wilaya_code,
      'logoUrl', s.logo_url, 'coverUrl', s.cover_url, 'ratingAvg', s.rating_avg, 'ratingCount', s.rating_count,
      'categoryId', (select sc.category_id from public.salon_categories sc where sc.salon_id = s.id order by sc.category_id limit 1)
    ) as j, m.sc, s.wilaya_code, s.rating_avg, s.rating_count
    from tous s, q,
      lateral (select coalesce((select array_agg(sc.category_id) from public.salon_categories sc join public.categories c on c.id = sc.category_id
                                where sc.salon_id = s.id and (p_gender is null or c.market::text = p_gender::text)), '{}'::text[]) as cats) k,
      lateral (select public.search_text_score(
        s.name,
        concat_ws(' ', s.city, s.zone,
          (select string_agg(sv.name, ' ') from public.services sv where sv.salon_id = s.id and sv.is_active
             and public.search_service_side(sv.name, sv.category_id, p_gender)),
          (select string_agg(c.label_fr || ' ' || coalesce(c.label_ar, ''), ' ') from public.categories c where c.id = any (k.cats))),
        k.cats, p_q) as sc) m
    where q.qq <> '' and m.sc > 0 and (s.dedans or m.sc >= 1.2)
    order by m.sc desc,
             (case when p_wilaya is not null and s.wilaya_code = p_wilaya then 0 else 1 end),
             s.rating_avg desc, s.rating_count desc
    limit 5
  ),
  services as (
    select jsonb_build_object('name', t.name, 'salonCount', t.cnt, 'minPriceDa', t.min_price) as j
    from (
      select initcap(sv.name) as name, count(distinct sv.salon_id) as cnt, min(sv.price_da) as min_price,
             max(case when public.search_flat(sv.name) like q.qq || '%' then 1.0
                      when position(q.qq in public.search_flat(sv.name)) > 0 then 0.85
                      else word_similarity(q.qq, public.search_flat(sv.name)) end) as sc
      from public.services sv join pub s on s.id = sv.salon_id, q
      where sv.is_active
        and public.search_service_side(sv.name, sv.category_id, p_gender)
        and (position(q.qq in public.search_flat(sv.name)) > 0
             or (length(q.qq) >= 4 and word_similarity(q.qq, public.search_flat(sv.name)) >= 0.55))
      group by initcap(sv.name)
      order by sc desc, cnt desc, min_price asc
      limit 5
    ) t
  ),
  places as (
    select jsonb_build_object('city', t.place, 'parentCity', t.parent_city, 'wilayaCode', t.wilaya_code, 'salonCount', t.cnt) as j
    from (
      select coalesce(nullif(s.zone, ''), s.city) as place,
             max(case when nullif(s.zone, '') is not null and s.zone <> s.city then s.city end) as parent_city,
             s.wilaya_code, count(*) as cnt
      from tous s, q
      where position(q.qq in public.search_flat(coalesce(s.zone, ''))) > 0
         or position(q.qq in public.search_flat(s.city)) > 0
         or (length(q.qq) >= 4 and greatest(word_similarity(q.qq, public.search_flat(coalesce(s.zone, ''))),
                                            word_similarity(q.qq, public.search_flat(s.city))) >= 0.6)
      group by coalesce(nullif(s.zone, ''), s.city), s.wilaya_code
      order by (case when p_wilaya is not null and s.wilaya_code = p_wilaya then 0 else 1 end), cnt desc
      limit 5
    ) t
  )
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(j order by cnt desc, sort_order) from categories), '[]'::jsonb),
    'salons', coalesce((select jsonb_agg(j order by sc desc, (case when p_wilaya is not null and wilaya_code = p_wilaya then 0 else 1 end), rating_avg desc, rating_count desc) from salons), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(j) from services), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(j) from places), '[]'::jsonb)
  )
$$;
