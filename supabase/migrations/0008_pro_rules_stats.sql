-- 0008 — Espace pro (design PRO-F 12/13/23) :
--   • règles : délai d'annulation client, temps de battement entre deux rendez-vous, déplacement à domicile,
--   • statistiques jour / semaine / mois : chiffre d'affaires par jour, encaissé / reste à encaisser, par prestation.

alter table public.salons
  add column if not exists cancel_min_hours smallint not null default 2 check (cancel_min_hours between 0 and 168),
  add column if not exists buffer_minutes smallint not null default 0 check (buffer_minutes between 0 and 120),
  add column if not exists home_service boolean not null default false;

-- Battement : chaque occupation (rendez-vous, blocage) est étendue du temps de battement.
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

-- Statistiques d'une période (dates locales Africa/Algiers, bornes incluses).
create or replace function public.pro_stats(p_salon_id uuid, p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select *, (starts_at at time zone 'Africa/Algiers')::date as d
    from public.bookings
    where salon_id = p_salon_id
      and (starts_at at time zone 'Africa/Algiers')::date between p_from and p_to
      and status in ('pending', 'confirmed', 'completed')
  ),
  days as (
    select gs::date as d from generate_series(p_from, p_to, interval '1 day') gs
  ),
  by_day as (
    select days.d,
      coalesce(sum(b.price_da) filter (where b.status in ('confirmed', 'completed')), 0)::int as revenue_da,
      count(b.id)::int as bookings
    from days left join b on b.d = days.d
    group by days.d order by days.d
  ),
  by_service as (
    select coalesce(bi.service_name, b.service_name) as name,
      count(*)::int as bookings,
      coalesce(sum(coalesce(bi.price_da, b.price_da)), 0)::int as revenue_da
    from b
    left join public.booking_items bi on bi.booking_id = b.id
    where b.status in ('confirmed', 'completed')
    group by 1 order by 3 desc limit 8
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'revenueDa', coalesce((select sum(price_da) from b where status in ('confirmed', 'completed')), 0),
    'bookings', (select count(*) from b),
    'pending', (select count(*) from b where status = 'pending'),
    'collectedDa', coalesce((select sum(price_da) from b where status = 'completed'), 0),
    'remainingDa', coalesce((select sum(price_da) from b where status = 'confirmed'), 0),
    'remainingCount', (select count(*) from b where status = 'confirmed'),
    'byDay', (select jsonb_agg(jsonb_build_object('date', d, 'revenueDa', revenue_da, 'bookings', bookings)) from by_day),
    'byService', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'bookings', bookings, 'revenueDa', revenue_da)) from by_service), '[]'::jsonb)
  )
$$;
grant execute on function public.pro_stats(uuid, date, date) to authenticated;
