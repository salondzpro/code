-- 0013 — Gestion pro : prestations affectées aux employés, groupes (catégories libres) de prestations,
-- disponibilités et réservations tenant compte des prestations que chaque membre sait réaliser.

-- 1) Employé ↔ prestations. all_services = true (défaut) : toutes les prestations du salon ;
--    sinon uniquement celles de staff_services.
alter table public.staff add column if not exists all_services boolean not null default true;

create table if not exists public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (staff_id, service_id)
);
alter table public.staff_services enable row level security;
drop policy if exists staff_services_public_read on public.staff_services;
create policy staff_services_public_read on public.staff_services for select using (true);

-- 2) Groupe de prestations (catégorie libre du catalogue : « Coupes », « Barbe », « Soins »…).
alter table public.services add column if not exists group_name text check (group_name is null or char_length(group_name) between 1 and 40);

-- 3) Disponibilités filtrées par prestations demandées.
drop function if exists public.get_available_slots_for(uuid, int, date, uuid, boolean, uuid);
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
      -- Prestations affectées : un membre « toutes prestations » ou qui couvre chacune des prestations demandées.
      and (p_service_ids is null or s.all_services or not exists (
        select 1 from unnest(p_service_ids) as req(service_id)
        where not exists (select 1 from public.staff_services ss where ss.staff_id = s.id and ss.service_id = req.service_id)
      ))
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
grant execute on function public.get_available_slots_for(uuid, int, date, uuid, boolean, uuid, uuid[]) to anon, authenticated;

-- 4) Réservation et report : mêmes garanties, membres filtrés par prestations.
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
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;

  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;
revoke execute on function public.create_booking_multi(uuid, uuid[], uuid, timestamptz, uuid, text, text, text, public.booking_source, boolean) from public, anon, authenticated;

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
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_b.status not in ('pending', 'confirmed') then
    raise exception 'BOOKING_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;
  select * into v_salon from public.salons where id = v_b.salon_id;
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
        set starts_at = p_starts_at, ends_at = v_ends, staff_id = v_staff
        where id = p_booking_id
        returning * into v_b;
      return v_b;
    exception when exclusion_violation then
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;
  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;
revoke execute on function public.reschedule_booking(uuid, timestamptz, uuid, boolean) from public, anon, authenticated;
