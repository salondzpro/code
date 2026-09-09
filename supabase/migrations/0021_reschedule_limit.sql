-- 0021 — Un rendez-vous ne peut être reporté en ligne qu'une seule fois par le client (anti-abus, confort du
-- professionnel). Le report par le pro (`p_enforce_rules = false`) ne compte pas. Au-delà : RESCHEDULE_LIMIT,
-- le client contacte le salon.
alter table public.bookings
  add column if not exists client_reschedules smallint not null default 0 check (client_reschedules >= 0);

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
  v_constraint text;
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
    -- Un seul report en ligne par rendez-vous : au-delà, le client contacte le salon (anti-abus).
    if v_b.client_reschedules >= 1 then
      raise exception 'RESCHEDULE_LIMIT' using errcode = 'P0001';
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
        set starts_at = p_starts_at, ends_at = v_ends, staff_id = v_staff,
            client_reschedules = client_reschedules + (case when p_enforce_rules then 1 else 0 end)
        where id = p_booking_id
        returning * into v_b;
      return v_b;
    exception when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_client_no_overlap' then
        raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
      end if;
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;
  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;
revoke execute on function public.reschedule_booking(uuid, timestamptz, uuid, boolean) from public, anon, authenticated;
