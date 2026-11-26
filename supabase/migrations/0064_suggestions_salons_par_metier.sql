-- SUGGESTIONS : les salons se trouvent aussi par ce qu'ils FONT (26 nov. 2026, demande du propriétaire :
-- « améliore les recherches »). Avant, la rubrique « salons » ne regardait que le NOM : taper « coif »,
-- « barbe » ou « ongles » ne proposait aucun salon, seulement des catégories. Le même score que la
-- recherche (`search_text_score`, migration 0063) sert désormais : nom d'abord, puis prestations,
-- catégories, synonymes fr/ar/en/darija et fautes de frappe. Signature inchangée.

create or replace function public.search_suggest(p_q text, p_gender public.gender_target default null, p_wilaya smallint default null)
returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with q as (select public.search_flat(p_q) as qq),
  pub as (
    select s.* from public.salons s
    where s.is_visible
      and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
  ),
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
    from pub s, q,
      lateral (select coalesce((select array_agg(sc.category_id) from public.salon_categories sc where sc.salon_id = s.id), '{}'::text[]) as cats) k,
      lateral (select public.search_text_score(
        s.name,
        concat_ws(' ', s.city, s.zone,
          (select string_agg(sv.name, ' ') from public.services sv where sv.salon_id = s.id and sv.is_active),
          (select string_agg(c.label_fr || ' ' || coalesce(c.label_ar, ''), ' ') from public.categories c where c.id = any (k.cats))),
        k.cats, p_q) as sc) m
    where q.qq <> '' and m.sc > 0
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
      from pub s, q
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

