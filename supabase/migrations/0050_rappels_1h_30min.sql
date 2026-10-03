-- 0050 — Les rappels du CLIENT passent à 1 h puis 30 min avant le rendez-vous.
--
-- Ils partaient la veille (migration 0041) et 2 h avant. Un rappel la veille arrive trop tôt pour
-- changer quoi que ce soit à la journée, et deux heures avant on est déjà engagé ailleurs. Une
-- heure, puis une dernière à trente minutes : c'est là qu'un rappel sert encore à partir à temps,
-- ou à prévenir le salon.
--
-- Les colonnes sont RENOMMÉES plutôt que remplacées : leur rôle est le même — « ce rappel-là est
-- parti » — et renommer conserve l'historique des rendez-vous déjà traités, donc aucun client ne
-- reçoit d'un coup un rappel pour un rendez-vous passé. Leur ancien nom aurait menti sur le délai.

alter table public.bookings rename column reminder_sent_at to reminder_1h_sent_at;
alter table public.bookings rename column reminder_2h_sent_at to reminder_30m_sent_at;

-- Un rendez-vous déplacé repart de zéro pour TOUS les rappels (client 1 h, client 30 min, pro).
create or replace function public.reset_reminder_on_move()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminder_1h_sent_at := null;
    new.reminder_30m_sent_at := null;
    new.reminder_pro_sent_at := null;
  end if;
  return new;
end $$;
