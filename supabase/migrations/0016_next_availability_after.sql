-- 0016 — Écran « Quand ? » : quand la journée choisie est complète, l'API renvoie la prochaine journée qui a
-- des créneaux libres pour les prestations choisies (durée cumulée + membres compétents), après la date demandée.
-- Réservée à l'API (clé secrète) : pas de grant anon/authenticated.
create or replace function public.next_availability_after(
  p_salon_id uuid,
  p_duration_minutes int,
  p_after date,
  p_days int default 14,
  p_service_ids uuid[] default null,
  p_staff_id uuid default null,
  p_limit int default 3
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_day date;
  v_slots jsonb;
  i int;
begin
  for i in 1 .. greatest(1, least(p_days, 60)) loop
    v_day := p_after + i;
    select coalesce(jsonb_agg(to_char(t.slot_start at time zone 'Africa/Algiers', 'HH24:MI') order by t.slot_start), '[]'::jsonb)
      into v_slots
    from (
      select distinct a.slot_start
      from public.get_available_slots_for(p_salon_id, coalesce(p_duration_minutes, 30), v_day, p_staff_id, true, null, p_service_ids) a
      order by a.slot_start
      limit greatest(1, p_limit)
    ) t;
    if jsonb_array_length(v_slots) > 0 then
      return jsonb_build_object('date', to_char(v_day, 'YYYY-MM-DD'), 'slots', v_slots);
    end if;
  end loop;
  return null;
end
$$;
