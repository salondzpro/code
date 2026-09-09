-- 0018 — Cartes marketplace simplifiées : deux moments seulement (Matin < 12 h, Après-midi ≥ 12 h, soir compris),
-- 7 jours pour que le client puisse ignorer les jours fermés et afficher « Complet aujourd'hui » puis les
-- disponibilités du lendemain. Chaque jour indique s'il est ouvert et l'heure de fermeture.
create or replace function public.period_availability(p_salon_ids uuid[], p_days int default 7)
returns table (salon_id uuid, periods jsonb)
language sql stable security definer set search_path = public as $$
  with d as (
    select (now() at time zone 'Africa/Algiers')::date + i as day
    from generate_series(0, greatest(1, least(coalesce(p_days, 7), 14)) - 1) i
  ),
  sal as (
    select s.id,
      coalesce((select min(sv.duration_minutes) from public.services sv where sv.salon_id = s.id and sv.is_active), 30) as dur
    from public.salons s
    where s.id = any(p_salon_ids)
  ),
  sl as (
    select sal.id as sid, d.day,
      coalesce(oh.open, false) as open,
      oh.closes_at,
      min(case when x.h < 12 then x.t end) as matin,
      min(case when x.h >= 12 then x.t end) as apres_midi
    from sal
    cross join d
    left join lateral (
      select bool_or(not o.is_closed) as open,
             to_char(max(o.closes_at) filter (where not o.is_closed), 'HH24:MI') as closes_at
      from public.opening_hours o
      where o.salon_id = sal.id and o.day_of_week = extract(dow from d.day)::int
    ) oh on true
    left join lateral (
      select to_char(a.slot_start at time zone 'Africa/Algiers', 'HH24:MI') as t,
             extract(hour from (a.slot_start at time zone 'Africa/Algiers')) as h
      from public.get_available_slots_for(sal.id, sal.dur, d.day, null, true, null, null) a
    ) x on true
    group by sal.id, d.day, oh.open, oh.closes_at
  )
  select sid as salon_id,
    jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'open', open, 'closesAt', closes_at, 'matin', matin, 'apresMidi', apres_midi) order by day) as periods
  from sl
  group by sid;
$$;
