-- 0009 — Revue sécurité et règles métier :
--   • privilèges : les fonctions réservées à l'API (clé secrète) ne sont plus exécutables par anon/authenticated
--     (create_booking_multi et pro_stats étaient appelables via PostgREST par n'importe quel compte),
--   • salons : « Report client » (autorisé ou non) et « Acompte » (design PRO-F 13), persistés,
--   • disponibilités : possibilité d'ignorer une réservation donnée (celle que l'on déplace),
--   • reschedule_booking : durée TOTALE de la réservation (prestations cumulées), horizon, délai client,
--     règle « report client », membre vérifié ; plus d'annulation temporaire — le trigger de notifications
--     envoyait « annulée » puis « confirmée » au lieu de « déplacée ».

-- ---------------------------------------------------------------------
-- 1) Privilèges
-- ---------------------------------------------------------------------
revoke execute on function public.create_booking_multi(uuid, uuid[], uuid, timestamptz, uuid, text, text, text, public.booking_source, boolean) from public, anon, authenticated;
revoke execute on function public.create_booking(uuid, uuid, uuid, timestamptz, uuid, text, text, text, public.booking_source, boolean) from public, anon, authenticated;
revoke execute on function public.reschedule_booking(uuid, timestamptz, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.pro_stats(uuid, date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Règles du salon
-- ---------------------------------------------------------------------
alter table public.salons
  add column if not exists allow_client_reschedule boolean not null default true,
  add column if not exists deposit_required boolean not null default false;

-- ---------------------------------------------------------------------
-- 3) Disponibilités : exclusion d'une réservation (report)
-- ---------------------------------------------------------------------
drop function if exists public.get_available_slots_for(uuid, int, date, uuid, boolean);
create or replace function public.get_available_slots_for(
  p_salon_id uuid,
  p_duration_minutes int,
  p_date date,
  p_staff_id uuid default null,
  p_enforce_lead_time boolean default true,
  p_exclude_booking uuid default null
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
grant execute on function public.get_available_slots_for(uuid, int, date, uuid, boolean, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Report d'une réservation
-- ---------------------------------------------------------------------
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
    select array_agg(a.staff_id order by (a.staff_id = v_b.staff_id) desc, st.sort_order, st.created_at) into v_candidates
    from public.get_available_slots_for(v_b.salon_id, v_b.duration_minutes, v_local_date, p_staff_id, true, v_b.id) a
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
