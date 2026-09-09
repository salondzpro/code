-- 0014 — Lancement simplifié : annulation client jusqu'à 1 h avant, blocage d'un client par un salon,
-- fiche client agrégée (nombre de rendez-vous, dernier, prochain, annulés, absences, bloqué).

-- 1) Annulation en ligne : jusqu'à 1 h avant (au lieu de 2).
alter table public.salons alter column cancel_min_hours set default 1;
update public.salons set cancel_min_hours = 1 where cancel_min_hours = 2;

-- 2) Clients bloqués (propre à chaque salon) : par compte et/ou par numéro de téléphone.
create table if not exists public.blocked_clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  client_id uuid references public.profiles (id) on delete cascade,
  phone text,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (client_id is not null or phone is not null)
);
create unique index if not exists blocked_clients_salon_client_idx on public.blocked_clients (salon_id, client_id) where client_id is not null;
create unique index if not exists blocked_clients_salon_phone_idx on public.blocked_clients (salon_id, phone) where phone is not null;
alter table public.blocked_clients enable row level security;

-- 3) Réservation : refusée si le client est bloqué par le salon.
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
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;

  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;
revoke execute on function public.create_booking_multi(uuid, uuid[], uuid, timestamptz, uuid, text, text, text, public.booking_source, boolean) from public, anon, authenticated;

-- 4) Fiche client agrégée pour l'espace pro (un client = compte, sinon numéro, sinon nom).
create or replace function public.salon_clients(p_salon_id uuid)
returns table (
  client_key text, client_id uuid, name text, phone text,
  bookings_count bigint, completed_count bigint, cancelled_count bigint, no_show_count bigint,
  last_at timestamptz, next_at timestamptz, last_booking_id uuid, blocked boolean, blocked_reason text
)
language sql stable security definer set search_path = public as $$
  with b as (
    select bk.*,
      coalesce(bk.client_id::text, bk.client_phone, lower(bk.client_name)) as ckey
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
      count(*) filter (where status = 'cancelled') as cancelled_count,
      count(*) filter (where status = 'no_show') as no_show_count,
      max(starts_at) filter (where starts_at <= now() and status <> 'cancelled') as last_at,
      min(starts_at) filter (where starts_at > now() and status in ('pending', 'confirmed')) as next_at,
      (array_agg(id order by (starts_at <= now()) desc, starts_at desc))[1] as last_booking_id
    from b group by ckey
  )
  select a.ckey, a.client_id, a.name, a.phone,
    a.bookings_count, a.completed_count, a.cancelled_count, a.no_show_count, a.last_at, a.next_at, a.last_booking_id,
    exists (select 1 from public.blocked_clients bc where bc.salon_id = p_salon_id
            and ((a.client_id is not null and bc.client_id = a.client_id) or (a.phone is not null and bc.phone = a.phone))) as blocked,
    (select bc.reason from public.blocked_clients bc where bc.salon_id = p_salon_id
            and ((a.client_id is not null and bc.client_id = a.client_id) or (a.phone is not null and bc.phone = a.phone)) limit 1) as blocked_reason
  from agg a
  order by coalesce(a.next_at, a.last_at) desc nulls last, a.name
$$;
revoke execute on function public.salon_clients(uuid) from public, anon, authenticated;
