-- 0046 — Rappel au PROFESSIONNEL avant chaque rendez-vous confirmé.
--
-- Le client reçoit déjà deux rappels (la veille, 2 h avant : migration 0041). Le professionnel, lui,
-- ne recevait que ses demandes et la relance d'une demande sans réponse : rien ne lui rappelait le
-- rendez-vous qui approche, d'où un message WhatsApp qu'on s'envoie à soi-même. Une colonne de plus
-- pour ne l'envoyer qu'UNE fois, remise à zéro quand le rendez-vous bouge.

alter table public.bookings add column if not exists reminder_pro_sent_at timestamptz;

-- Un rendez-vous déplacé repart de zéro pour TOUS les rappels (client la veille, client 2 h avant, pro).
create or replace function public.reset_reminder_on_move()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminder_sent_at := null;
    new.reminder_2h_sent_at := null;
    new.reminder_pro_sent_at := null;
  end if;
  return new;
end $$;
