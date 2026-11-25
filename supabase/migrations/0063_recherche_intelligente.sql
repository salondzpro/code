-- RECHERCHE INTELLIGENTE DE LA PLACE DE MARCHÉ (25 nov. 2026, demande du propriétaire :
-- « un algorithme ultra puissant, recherche avancée style Uber »).
--
-- Ce qui change :
--   1. COMPRENDRE la saisie : chaque mot est cherché séparément (« coupe akbou », « barbe pas cher »
--      ne demandent plus une phrase exacte), sans accent ni majuscule, avec FAUTES DE FRAPPE
--      tolérées (pg_trgm : « coifure » trouve « Coiffure ») et un DICTIONNAIRE de synonymes
--      français / arabe / anglais / darija vers les catégories (« fade », « لحية », « nails »…).
--   2. CLASSER comme une application de 20 ans d'âge : score de pertinence = texte (le nom passe
--      avant une prestation, le début d'un mot avant le milieu) + proximité (décroissance
--      exponentielle de la distance) + qualité (note bayésienne : 5 étoiles sur 1 avis ne passe
--      pas devant 4,8 sur 60) + disponibilité (créneau aujourd'hui, sinon bientôt) + ouvert.
--   3. SUGGÉRER mieux : catégories reconnues (intention), prestations, salons et lieux, tolérants
--      aux fautes ; les salons masqués par la plateforme n'y apparaissent plus (`is_visible`,
--      la fonction lisait encore `is_published`).
--
-- Signatures inchangées (`create or replace`) : privilèges conservés, aucun changement d'API requis
-- pour la recherche ; les suggestions gagnent une rubrique `categories`.

-- ---------------------------------------------------------------------------------------------
-- 1) Dictionnaire de synonymes → catégories. Termes APLATIS (sans accent, minuscules).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.search_synonyms (
  term text primary key,
  category_ids text[] not null
);
alter table public.search_synonyms enable row level security;
revoke all on public.search_synonyms from anon, authenticated;

insert into public.search_synonyms (term, category_ids) values
  -- Coiffure (générique)
  ('coiffure', '{coiffure,coiffure-homme,coiffure-femme,coiffure-lissage}'),
  ('coiffeur', '{coiffure,coiffure-homme,coiffure-femme,coiffure-lissage,barbier}'),
  ('coiffeuse', '{coiffure,coiffure-femme,coiffure-lissage}'),
  ('cheveux', '{coiffure,coiffure-homme,coiffure-femme,coiffure-lissage}'),
  ('coupe', '{coiffure,coiffure-homme,coiffure-femme,coiffure-lissage,barbier}'),
  ('brushing', '{coiffure,coiffure-femme,coiffure-lissage}'),
  ('chignon', '{coiffure,coiffure-femme}'),
  ('coiff', '{coiffure,coiffure-homme,coiffure-femme,coiffure-lissage}'),
  ('hair', '{coiffure,coiffure-homme,coiffure-femme,coiffure-lissage}'),
  ('haircut', '{coiffure,coiffure-homme,coiffure-femme,barbier}'),
  ('حلاقة', '{coiffure,coiffure-homme,barbier}'),
  ('حلاق', '{coiffure-homme,barbier}'),
  ('كوافير', '{coiffure,coiffure-femme,coiffure-lissage}'),
  ('كوافيرة', '{coiffure,coiffure-femme,coiffure-lissage}'),
  ('شعر', '{coiffure,coiffure-homme,coiffure-femme,coiffure-lissage}'),
  ('تسريحة', '{coiffure,coiffure-femme}'),
  -- Barbier, barbe
  ('barbier', '{barbier,barbe,coiffure-homme}'),
  ('barber', '{barbier,barbe,coiffure-homme}'),
  ('barbe', '{barbe,barbier}'),
  ('rasage', '{barbe,barbier}'),
  ('degrade', '{barbier,barbe,coiffure-homme,coiffure}'),
  ('fade', '{barbier,barbe,coiffure-homme,coiffure}'),
  ('contour', '{barbe,barbier}'),
  ('taper', '{barbier,barbe,coiffure-homme,coiffure}'),
  ('لحية', '{barbe,barbier}'),
  ('ديقرادي', '{barbier,barbe,coiffure-homme,coiffure}'),
  -- Lissage
  ('lissage', '{lissage,coiffure-lissage}'),
  ('keratine', '{lissage,coiffure-lissage}'),
  ('proteine', '{lissage,coiffure-lissage}'),
  ('botox', '{lissage,coiffure-lissage}'),
  ('tanin', '{lissage,coiffure-lissage}'),
  ('تمليس', '{lissage,coiffure-lissage}'),
  ('كيراتين', '{lissage,coiffure-lissage}'),
  ('بروتين', '{lissage,coiffure-lissage}'),
  -- Couleur
  ('coloration', '{coloration-meches}'),
  ('couleur', '{coloration-meches}'),
  ('meches', '{coloration-meches}'),
  ('balayage', '{coloration-meches}'),
  ('ombre', '{coloration-meches}'),
  ('teinture', '{coloration-meches}'),
  ('blond', '{coloration-meches}'),
  ('صبغة', '{coloration-meches}'),
  ('ميش', '{coloration-meches}'),
  -- Ongles
  ('ongles', '{ongles,onglerie,manucure}'),
  ('ongle', '{ongles,onglerie,manucure}'),
  ('vernis', '{ongles,onglerie,manucure}'),
  ('gel', '{ongles,onglerie}'),
  ('capsule', '{ongles,onglerie}'),
  ('capsules', '{ongles,onglerie}'),
  ('semi', '{ongles,onglerie,manucure}'),
  ('manucure', '{manucure,ongles,onglerie}'),
  ('pedicure', '{manucure,ongles,onglerie}'),
  ('nail', '{ongles,onglerie,manucure}'),
  ('nails', '{ongles,onglerie,manucure}'),
  ('اظافر', '{ongles,onglerie,manucure}'),
  ('مناكير', '{manucure,ongles,onglerie}'),
  ('فرنيس', '{ongles,onglerie,manucure}'),
  -- Cils, sourcils
  ('cils', '{cils}'),
  ('cil', '{cils}'),
  ('rehaussement', '{cils}'),
  ('lash', '{cils}'),
  ('lashes', '{cils}'),
  ('رموش', '{cils}'),
  ('sourcils', '{sourcils}'),
  ('sourcil', '{sourcils}'),
  ('brow', '{sourcils}'),
  ('brows', '{sourcils}'),
  ('microblading', '{sourcils}'),
  ('restructuration', '{sourcils}'),
  ('حواجب', '{sourcils}'),
  -- Maquillage, mariée
  ('maquillage', '{maquillage}'),
  ('makeup', '{maquillage}'),
  ('maquilleuse', '{maquillage}'),
  ('mariee', '{maquillage,coiffure-femme,coiffure}'),
  ('mariage', '{maquillage,coiffure-femme,coiffure}'),
  ('fiancailles', '{maquillage,coiffure-femme,coiffure}'),
  ('مكياج', '{maquillage}'),
  ('ماكياج', '{maquillage}'),
  ('عروس', '{maquillage,coiffure-femme,coiffure}'),
  ('عرس', '{maquillage,coiffure-femme,coiffure}'),
  -- Épilation, laser
  ('epilation', '{epilation,laser}'),
  ('cire', '{epilation}'),
  ('fil', '{epilation,sourcils}'),
  ('laser', '{laser,epilation}'),
  ('waxing', '{epilation}'),
  ('ازالة', '{epilation,laser}'),
  ('ليزر', '{laser,epilation}'),
  ('سير', '{epilation}'),
  -- Soins, peau
  ('soin', '{soins,soins-peau,esthetique}'),
  ('soins', '{soins,soins-peau,esthetique}'),
  ('visage', '{soins,soins-peau,esthetique}'),
  ('peau', '{soins-peau,soins,esthetique}'),
  ('nettoyage', '{soins-peau,soins}'),
  ('hydrafacial', '{soins-peau,soins}'),
  ('facial', '{soins-peau,soins}'),
  ('esthetique', '{esthetique,soins,soins-peau}'),
  ('estheticienne', '{esthetique,soins,soins-peau,epilation}'),
  ('بشرة', '{soins-peau,soins}'),
  ('تنظيف', '{soins-peau,soins}'),
  -- Spa, hammam
  ('hammam', '{spa-hammam}'),
  ('spa', '{spa-hammam}'),
  ('massage', '{spa-hammam}'),
  ('gommage', '{spa-hammam,soins}'),
  ('sauna', '{spa-hammam}'),
  ('حمام', '{spa-hammam}'),
  ('مساج', '{spa-hammam}'),
  ('تدليك', '{spa-hammam}'),
  -- Tresses
  ('tresses', '{tresses}'),
  ('tresse', '{tresses}'),
  ('braids', '{tresses}'),
  ('nattes', '{tresses}'),
  ('box', '{tresses}'),
  ('ضفائر', '{tresses}')
on conflict (term) do update set category_ids = excluded.category_ids;

-- ---------------------------------------------------------------------------------------------
-- 2) Forme comparable d'un texte : sans accent, minuscules, ponctuation en espaces.
-- ---------------------------------------------------------------------------------------------
create or replace function public.search_flat(p text)
returns text language sql immutable parallel safe set search_path = public, extensions as $$
  select btrim(regexp_replace(lower(public.f_unaccent(coalesce(p, ''))), '[[:punct:][:space:]]+', ' ', 'g'))
$$;

-- Mots vides : n'exigent aucune correspondance (« salon de coiffure à Akbou »).
create or replace function public.search_is_stopword(w text)
returns boolean language sql immutable parallel safe as $$
  select w = any (array['de','du','des','la','le','les','l','d','a','au','aux','et','en','pour','chez','un','une',
                        'salon','salons','institut','centre','près','pres','proche','moi','cherche','في','من','عند','صالون'])
$$;

-- Catégories que désigne un mot (synonyme exact, début de mot dès 3 lettres, ou faute de frappe).
create or replace function public.search_word_categories(w text)
returns text[] language sql stable set search_path = public, extensions as $$
  select coalesce(array_agg(distinct c), '{}'::text[])
  from public.search_synonyms s, unnest(s.category_ids) c
  where s.term = w
     or (length(w) >= 3 and s.term like w || '%')
     or (length(w) >= 4 and similarity(s.term, w) >= 0.5)
$$;

-- ---------------------------------------------------------------------------------------------
-- 3) Score texte d'un salon pour une saisie : 0 = ne correspond pas (chaque mot utile doit
--    trouver quelque chose : ET logique), sinon moyenne des meilleurs scores des mots (≤ 1,2).
-- ---------------------------------------------------------------------------------------------
create or replace function public.search_text_score(p_name text, p_rest text, p_cats text[], p_q text)
returns real language plpgsql stable set search_path = public, extensions as $$
declare
  qq text := public.search_flat(p_q);
  nm text := public.search_flat(p_name);
  rs text := public.search_flat(p_rest);
  w text;
  best real;
  total real := 0;
  n int := 0;
begin
  if qq = '' then return 1; end if;
  -- La saisie entière en tête du nom : c'est le salon cherché.
  if nm = qq then return 1.3; end if;
  if nm like qq || '%' then return 1.2; end if;
  foreach w in array regexp_split_to_array(qq, ' ') loop
    if length(w) < 2 or public.search_is_stopword(w) then continue; end if;
    n := n + 1;
    if nm ~ ('(^| )' || w) then best := 1;
    elsif position(w in nm) > 0 then best := 0.85;
    elsif rs ~ ('(^| )' || w) then best := 0.8;
    elsif length(w) >= 3 and position(w in rs) > 0 then best := 0.65;
    elsif p_cats && public.search_word_categories(w) then best := 0.75;
    else
      -- Faute de frappe : ressemblance d'un mot de la saisie avec un mot du salon.
      best := greatest(word_similarity(w, nm), word_similarity(w, rs) * 0.9);
      if length(w) < 4 or best < 0.55 then best := 0; else best := best * 0.7; end if;
    end if;
    if best = 0 then return 0; end if;
    total := total + best;
  end loop;
  if n = 0 then return 1; end if;
  return total / n;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4) Recherche de salons (même signature que 0048, classement « pertinence » refait).
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
          (select string_agg(sv.name, ' ') from public.services sv where sv.salon_id = z.id and sv.is_active),
          (select string_agg(c.label_fr || ' ' || coalesce(c.label_ar, ''), ' ')
             from public.categories c where c.id = any (z.cat_ids0))),
        z.cat_ids0, p_q) else 1 end as txt
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

-- ---------------------------------------------------------------------------------------------
-- 5) Suggestions (même signature que 0012) : + catégories, fautes tolérées, `is_visible`.
-- ---------------------------------------------------------------------------------------------
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
  salons as (
    select jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'name', s.name, 'city', s.city, 'zone', s.zone, 'wilayaCode', s.wilaya_code,
      'logoUrl', s.logo_url, 'coverUrl', s.cover_url, 'ratingAvg', s.rating_avg, 'ratingCount', s.rating_count,
      'categoryId', (select sc.category_id from public.salon_categories sc where sc.salon_id = s.id order by sc.category_id limit 1)
    ) as j
    from pub s, q,
      lateral (select public.search_flat(s.name) as nm) n,
      lateral (select case
        when n.nm like q.qq || '%' then 1.0
        when n.nm like '% ' || q.qq || '%' then 0.9
        when position(q.qq in n.nm) > 0 then 0.8
        when length(q.qq) >= 3 then word_similarity(q.qq, n.nm)
        else 0 end as sc) m
    where m.sc >= 0.5
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
    'salons', coalesce((select jsonb_agg(j) from salons), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(j) from services), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(j) from places), '[]'::jsonb)
  )
$$;

-- Les fonctions d'aide ne sont appelées que par les deux fonctions publiques (security definer).
revoke execute on function public.search_text_score(text, text, text[], text) from public, anon, authenticated;
revoke execute on function public.search_word_categories(text) from public, anon, authenticated;
