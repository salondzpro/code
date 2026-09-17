-- Rappels de rendez-vous côté client : ce ne sont pas des messages WhatsApp mais des NOTIFICATIONS
-- (application mobile si elle est installée, sinon navigateur ; toujours visibles dans l'application).
-- 1) Le réglage change de nom pour dire ce qu'il fait.
alter table public.profiles rename column whatsapp_reminders to reminders_enabled;

-- 2) Deux rappels : la veille (reminder_sent_at, existant) et 2 h avant (nouveau).
alter table public.bookings add column if not exists reminder_2h_sent_at timestamptz;

-- 3) Un rendez-vous déplacé repart de zéro pour les deux rappels.
create or replace function public.reset_reminder_on_move()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminder_sent_at := null;
    new.reminder_2h_sent_at := null;
  end if;
  return new;
end $$;
