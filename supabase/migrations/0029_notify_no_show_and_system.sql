-- Notifications : combler deux trous du point de vue de la cliente.
--
-- 1) `no_show` ne produisait aucune notification. Le pro pouvait signaler une absence, le
--    badge passait à « Client absent », et la cliente n'était prévenue par rien — alors que
--    l'absence compte double dans les règles anti-abus (suspension dès la deuxième).
--
-- 2) L'expiration automatique d'une demande par le cron (`cancelled_by = 'system'`) tombait
--    dans la même branche que l'annulation par le salon : la cliente recevait « $salon a
--    annulé » alors que l'écran, lui, affichait « Demande expirée ». Le message accusait le
--    salon d'un geste qu'il n'avait pas fait. Chacun a maintenant sa branche, et le salon est
--    prévenu lui aussi qu'une demande lui a filé entre les doigts.
--
-- Le reste de la fonction est repris à l'identique de 0002.

create or replace function public.bookings_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_salon_name text;
  v_when text;
  v_data jsonb;
begin
  select owner_id, name into v_owner, v_salon_name from public.salons where id = new.salon_id;
  v_when := public.fmt_booking_when(new.starts_at);
  v_data := jsonb_build_object('bookingId', new.id, 'salonId', new.salon_id, 'status', new.status);

  if tg_op = 'INSERT' then
    if new.source = 'online' then
      insert into public.notifications (user_id, type, title, body, data, booking_id)
      values (v_owner, 'booking_created', 'Nouvelle réservation',
        new.client_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);
      if new.client_id is not null then
        insert into public.notifications (user_id, type, title, body, data, booking_id)
        values (new.client_id,
          (case when new.status = 'confirmed' then 'booking_confirmed' else 'booking_created' end)::public.notification_type,
          case when new.status = 'confirmed' then 'Réservation confirmée' else 'Demande envoyée' end,
          v_salon_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);
      end if;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'confirmed' and new.client_id is not null then
      insert into public.notifications (user_id, type, title, body, data, booking_id)
      values (new.client_id, 'booking_confirmed', 'Réservation confirmée',
        v_salon_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);

    elsif new.status = 'cancelled' then
      if new.cancelled_by = 'client' then
        insert into public.notifications (user_id, type, title, body, data, booking_id)
        values (v_owner, 'booking_cancelled', 'Réservation annulée',
          new.client_name || ' a annulé · ' || new.service_name || ' · ' || v_when, v_data, new.id);

      elsif new.cancelled_by = 'system' then
        -- Demande jamais traitée : le créneau est rendu. Personne n'a « annulé ».
        if new.client_id is not null then
          insert into public.notifications (user_id, type, title, body, data, booking_id)
          values (new.client_id, 'booking_cancelled', 'Demande expirée',
            v_salon_name || ' n''a pas confirmé à temps · ' || new.service_name || ' · ' || v_when,
            v_data, new.id);
        end if;
        insert into public.notifications (user_id, type, title, body, data, booking_id)
        values (v_owner, 'booking_cancelled', 'Demande expirée',
          new.client_name || ' · ' || new.service_name || ' · ' || v_when
          || ' — demande non confirmée à temps', v_data, new.id);

      elsif new.client_id is not null then
        insert into public.notifications (user_id, type, title, body, data, booking_id)
        values (new.client_id, 'booking_cancelled', 'Réservation annulée',
          v_salon_name || ' a annulé · ' || new.service_name || ' · ' || v_when
          || coalesce(' — ' || new.cancellation_reason, ''), v_data, new.id);
      end if;

    elsif new.status = 'no_show' and new.client_id is not null then
      insert into public.notifications (user_id, type, title, body, data, booking_id)
      values (new.client_id, 'booking_no_show', 'Absence signalée',
        v_salon_name || ' a signalé une absence · ' || new.service_name || ' · ' || v_when,
        v_data, new.id);

    elsif new.status = 'completed' and new.client_id is not null then
      insert into public.notifications (user_id, type, title, body, data, booking_id)
      values (new.client_id, 'booking_completed', 'Merci pour votre visite',
        'Donnez votre avis sur ' || v_salon_name, v_data, new.id);
    end if;

  elsif new.starts_at is distinct from old.starts_at and new.client_id is not null
        and new.status in ('pending', 'confirmed') then
    insert into public.notifications (user_id, type, title, body, data, booking_id)
    values (new.client_id, 'booking_rescheduled', 'Réservation déplacée',
      v_salon_name || ' · ' || new.service_name || ' · ' || v_when, v_data, new.id);
  end if;
  return new;
end $$;
