-- 0017 — Cartes marketplace « à la Planity » : pour chaque salon, les prochains jours avec le premier créneau libre
-- par moment de la journée (Matin < 12 h, Après-midi 12–17 h, Soir ≥ 17 h). Un seul appel pour toute une page
-- de résultats. Durée de référence = prestation active la plus courte (comme next_availability).
-- Réservée à l'API (clé secrète) : pas de grant anon/authenticated.
create or replace function public.period_availability(p_salon_ids uuid[], p_days int default 3)
returns table (salon_id uuid, periods jsonb)
language sql stable security definer set search_path = public as $$
  with d as (
    select (now() at time zone 'Africa/Algiers')::date + i as day
    from generate_series(0, greatest(1, least(coalesce(p_days, 3), 7)) - 1) i
  ),
  sal as (
    select s.id,
      coalesce((select min(sv.duration_minutes) from public.services sv where sv.salon_id = s.id and sv.is_active), 30) as dur
    from public.salons s
    where s.id = any(p_salon_ids)
  ),
  sl as (
    select sal.id as sid, d.day,
      min(case when x.h < 12 then x.t end) as matin,
      min(case when x.h >= 12 and x.h < 17 then x.t end) as apres_midi,
      min(case when x.h >= 17 then x.t end) as soir
    from sal
    cross join d
    left join lateral (
      select to_char(a.slot_start at time zone 'Africa/Algiers', 'HH24:MI') as t,
             extract(hour from (a.slot_start at time zone 'Africa/Algiers')) as h
      from public.get_available_slots_for(sal.id, sal.dur, d.day, null, true, null, null) a
    ) x on true
    group by sal.id, d.day
  )
  select sid as salon_id,
    jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'matin', matin, 'apresMidi', apres_midi, 'soir', soir) order by day) as periods
  from sl
  group by sid;
$$;
