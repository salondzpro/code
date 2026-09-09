-- 0022 — Cartes marketplace : « Prochaines disponibilités » = les 5 premiers créneaux réellement libres du
-- premier jour disponible (aujourd'hui, sinon demain, sinon le prochain jour ouvert et non complet), en un seul
-- appel pour toute la page. Durée de référence = prestation active la plus courte (la durée réelle des
-- prestations choisies est revérifiée sur l'écran « Quand ? », puis en SQL à la réservation).
-- Réservée à l'API (clé secrète) : pas de grant anon/authenticated.
create or replace function public.next_slots_many(p_salon_ids uuid[], p_days int default 7, p_limit int default 5)
returns table (salon_id uuid, day date, slots jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  v_sid uuid;
  v_dur int;
  v_today date := (now() at time zone 'Africa/Algiers')::date;
  v_day date;
  v_slots jsonb;
  i int;
begin
  if p_salon_ids is null then return; end if;
  foreach v_sid in array p_salon_ids loop
    select coalesce(min(sv.duration_minutes), 30) into v_dur
    from public.services sv where sv.salon_id = v_sid and sv.is_active;
    for i in 0 .. greatest(1, least(coalesce(p_days, 7), 14)) - 1 loop
      v_day := v_today + i;
      select coalesce(jsonb_agg(d.hm order by d.hm), '[]'::jsonb) into v_slots
      from (
        select x.hm
        from (
          select distinct to_char(a.slot_start at time zone 'Africa/Algiers', 'HH24:MI') as hm
          from public.get_available_slots_for(v_sid, v_dur, v_day, null, true, null, null) a
        ) x
        order by x.hm
        limit greatest(1, least(coalesce(p_limit, 5), 12))
      ) d;
      if jsonb_array_length(v_slots) > 0 then
        salon_id := v_sid; day := v_day; slots := v_slots;
        return next;
        exit;
      end if;
    end loop;
  end loop;
  return;
end
$$;
