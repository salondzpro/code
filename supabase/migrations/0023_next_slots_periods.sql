-- 0023 — Cartes marketplace : pour le premier jour disponible (aujourd'hui → demain → prochain jour ouvert et
-- non complet), les créneaux libres les plus proches répartis en MATIN (< 12 h) et APRÈS-MIDI (≥ 12 h),
-- 3 par période au plus (`slots` garde les 6 premiers de la journée pour les autres écrans).
drop function if exists public.next_slots_many(uuid[], int, int);
create or replace function public.next_slots_many(p_salon_ids uuid[], p_days int default 7, p_limit int default 3)
returns table (salon_id uuid, day date, slots jsonb, morning jsonb, afternoon jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  v_sid uuid;
  v_dur int;
  v_today date := (now() at time zone 'Africa/Algiers')::date;
  v_day date;
  v_all jsonb;
  v_m jsonb;
  v_a jsonb;
  v_lim int := greatest(1, least(coalesce(p_limit, 3), 6));
  i int;
begin
  if p_salon_ids is null then return; end if;
  foreach v_sid in array p_salon_ids loop
    select coalesce(min(sv.duration_minutes), 30) into v_dur
    from public.services sv where sv.salon_id = v_sid and sv.is_active;
    for i in 0 .. greatest(1, least(coalesce(p_days, 7), 14)) - 1 loop
      v_day := v_today + i;
      select
        coalesce(jsonb_agg(y.hm order by y.hm) filter (where y.rn_all <= 6), '[]'::jsonb),
        coalesce(jsonb_agg(y.hm order by y.hm) filter (where y.morning and y.rn <= v_lim), '[]'::jsonb),
        coalesce(jsonb_agg(y.hm order by y.hm) filter (where not y.morning and y.rn <= v_lim), '[]'::jsonb)
      into v_all, v_m, v_a
      from (
        select x.hm, (x.hm < '12:00') as morning,
          row_number() over (partition by (x.hm < '12:00') order by x.hm) as rn,
          row_number() over (order by x.hm) as rn_all
        from (
          select distinct to_char(a.slot_start at time zone 'Africa/Algiers', 'HH24:MI') as hm
          from public.get_available_slots_for(v_sid, v_dur, v_day, null, true, null, null) a
        ) x
      ) y;
      if jsonb_array_length(v_all) > 0 then
        salon_id := v_sid; day := v_day; slots := v_all; morning := v_m; afternoon := v_a;
        return next;
        exit;
      end if;
    end loop;
  end loop;
  return;
end
$$;
