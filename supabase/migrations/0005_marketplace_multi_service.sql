-- 0005 — Marketplace et prestations cumulées (design C-H 01→08, C-F 01→13) :
--   • disponibilités calculées pour une durée quelconque (plusieurs prestations enchaînées),
--   • réservation multi-prestations : une réservation = un bloc de temps + ses lignes (booking_items),
--   • recherche v2 : rayon, marché, quartier, logo, prestations phares, prochains créneaux du jour,
--     ouvert maintenant, nombre total de résultats,
--   • quartiers proches avec nombre de professionnels et distance.

-- ---------------------------------------------------------------------
-- Disponibilités par durée (source de vérité unique, réutilisée par tout le reste)
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots_for(
  p_salon_id uuid,
  p_duration_minutes int,
  p_date date,
  p_staff_id uuid default null,
  p_enforce_lead_time boolean default true
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
begin
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then return; end if;
  if p_duration_minutes is null or p_duration_minutes <= 0 then return; end if;

  v_dow := extract(dow from p_date)::int; -- 0 = dimanche
  v_day_start := (p_date::timestamp) at time zone 'Africa/Algiers';
  v_day_end := v_day_start + interval '1 day';
  v_duration := make_interval(mins => p_duration_minutes);
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
    select ss.id as sid,
           greatest(v_day_start + sh.starts_at::interval, v_day_start + oh.opens_at::interval) as win_start,
           least(v_day_start + sh.ends_at::interval, v_day_start + oh.closes_at::interval) as win_end
    from staff_set ss
    join public.staff_hours sh on sh.staff_id = ss.id and sh.day_of_week = v_dow
    join public.opening_hours oh on oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
    where sh.starts_at < oh.closes_at and sh.ends_at > oh.opens_at
    union all
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
grant execute on function public.get_available_slots_for(uuid, int, date, uuid, boolean) to anon, authenticated;

-- L'ancienne signature (par prestation) devient un simple raccourci.
create or replace function public.get_available_slots(
  p_salon_id uuid,
  p_service_id uuid,
  p_date date,
  p_staff_id uuid default null,
  p_enforce_lead_time boolean default true
)
returns table (slot_start timestamptz, staff_id uuid)
language sql stable security definer set search_path = public as $$
  select a.slot_start, a.staff_id
  from public.services sv
  cross join lateral public.get_available_slots_for(p_salon_id, sv.duration_minutes, p_date, p_staff_id, p_enforce_lead_time) a
  where sv.id = p_service_id and sv.salon_id = p_salon_id
$$;

-- Durée totale d'une liste de prestations actives d'un salon (toutes doivent exister).
create or replace function public.services_total(p_salon_id uuid, p_service_ids uuid[])
returns table (duration_minutes int, price_da int, label text, n int)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(sv.duration_minutes), 0)::int,
         coalesce(sum(sv.price_da), 0)::int,
         string_agg(sv.name, ' + ' order by ord.i),
         count(*)::int
  from unnest(p_service_ids) with ordinality as ord(id, i)
  join public.services sv on sv.id = ord.id and sv.salon_id = p_salon_id and sv.is_active
$$;
grant execute on function public.services_total(uuid, uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Lignes de réservation (prestations cumulées)
-- ---------------------------------------------------------------------
create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null,
  duration_minutes smallint not null check (duration_minutes > 0),
  price_da integer not null check (price_da >= 0),
  sort_order smallint not null default 0
);
create index if not exists booking_items_booking_idx on public.booking_items (booking_id, sort_order);
alter table public.booking_items enable row level security;
create policy "booking_items: client ou salon" on public.booking_items for select
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and (b.client_id = auth.uid() or public.is_salon_owner(b.salon_id))
  ));

-- Réservation atomique multi-prestations. Même règles que create_booking (0001) ;
-- la durée et le prix sont la somme des prestations, le nom leur concaténation.
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
begin
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'SERVICE_INACTIVE' using errcode = 'P0001';
  end if;
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then
    raise exception 'SALON_NOT_FOUND' using errcode = 'P0002';
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
    from public.get_available_slots_for(p_salon_id, v_total.duration_minutes, v_local_date, p_staff_id, true) a
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
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;

  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;

-- L'ancienne fonction à une prestation délègue (mêmes garanties, mêmes codes d'erreur).
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
language sql security definer set search_path = public as $$
  select * from public.create_booking_multi(
    p_salon_id, array[p_service_id], p_staff_id, p_starts_at, p_client_id,
    p_client_name, p_client_phone, p_notes, p_source, p_enforce_rules)
$$;

-- ---------------------------------------------------------------------
-- Recherche v2 (marketplace) : rayon, marché, quartier, prestations phares, prochains créneaux
-- ---------------------------------------------------------------------
create or replace function public.search_salons_v2(
  p_q text default null,
  p_wilaya smallint default null,
  p_city text default null,
  p_category text default null,
  p_gender public.gender_target default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_sort text default 'relevance', -- relevance | rating | price_asc | price_desc
  p_available_today boolean default false,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, slug text, name text, city text, zone text, wilaya_code smallint, cover_url text, logo_url text,
  gender_target public.gender_target, rating_avg numeric, rating_count int,
  category_ids text[], min_price_da int, distance_km double precision,
  top_services jsonb, next_slots jsonb, is_open_now boolean, total_count bigint
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
      coalesce((select jsonb_agg(to_char(t.slot_start at time zone 'Africa/Algiers', 'HH24:MI') order by t.slot_start)
                from (select distinct a.slot_start
                      from public.get_available_slots_for(b.id, coalesce(b.min_duration, 30), (now() at time zone 'Africa/Algiers')::date, null, true) a
                      order by a.slot_start limit 3) t),
               '[]'::jsonb) as slots_today,
      exists (
        select 1 from public.opening_hours oh
        where oh.salon_id = b.id and not oh.is_closed
          and oh.day_of_week = extract(dow from (now() at time zone 'Africa/Algiers'))::int
          and (now() at time zone 'Africa/Algiers')::time between oh.opens_at and oh.closes_at
      ) as open_now
    from base b
    where (p_radius_km is null or b.dist is null or b.dist <= p_radius_km)
  ),
  filtered as (
    select * from enriched e
    where (not p_available_today or jsonb_array_length(e.slots_today) > 0)
  )
  select f.id, f.slug, f.name, f.city, f.zone, f.wilaya_code, f.cover_url, f.logo_url, f.gender_target,
         f.rating_avg, f.rating_count, f.cat_ids, f.min_price, f.dist, f.top_svc, f.slots_today, f.open_now,
         count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'rating' then -coalesce(f.rating_avg, 0) end asc nulls last,
    case when p_sort = 'price_asc' then f.min_price end asc nulls last,
    case when p_sort = 'price_desc' then -f.min_price end asc nulls last,
    case when p_sort = 'relevance' then (case when jsonb_array_length(f.slots_today) > 0 then 0 else 1 end) end asc,
    (case when p_lat is not null and p_lng is not null and f.lat is not null then 0 else 1 end),
    f.dist asc nulls last,
    f.rating_avg desc, f.rating_count desc, f.created_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
$$;
grant execute on function public.search_salons_v2(text, smallint, text, text, public.gender_target, double precision, double precision, double precision, text, boolean, int, int) to anon, authenticated;

-- Quartiers (villes) avec nombre de professionnels publiés et distance au point donné.
create or replace function public.salon_cities(
  p_wilaya smallint default null,
  p_gender public.gender_target default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_q text default null
)
returns table (city text, wilaya_code smallint, salon_count bigint, distance_km double precision)
language sql stable security definer set search_path = public as $$
  select s.city, s.wilaya_code, count(*) as salon_count,
    case when p_lat is not null and p_lng is not null and avg(s.lat) is not null then
      6371 * acos(least(1.0, cos(radians(p_lat)) * cos(radians(avg(s.lat))) * cos(radians(avg(s.lng)) - radians(p_lng))
                + sin(radians(p_lat)) * sin(radians(avg(s.lat)))))
    end as distance_km
  from public.salons s
  where s.is_published
    and (p_wilaya is null or s.wilaya_code = p_wilaya)
    and (p_gender is null or s.gender_target = p_gender or s.gender_target = 'unisex')
    and (p_q is null or p_q = '' or public.f_unaccent(s.city) ilike '%' || public.f_unaccent(p_q) || '%')
  group by s.city, s.wilaya_code
  order by distance_km asc nulls last, salon_count desc, s.city
  limit 30
$$;
grant execute on function public.salon_cities(smallint, public.gender_target, double precision, double precision, text) to anon, authenticated;
