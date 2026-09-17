-- Réglage « Confirmations » (Réglages client) : jusqu'ici un interrupteur local au navigateur, jamais lu
-- par le serveur. Il vit désormais sur le profil : à `false`, les notifications de réservation,
-- confirmation, report et annulation restent dans l'application mais ne sont plus poussées (push).
-- Les rappels ont leur propre réglage (`whatsapp_reminders`) ; les demandes reçues par un pro ne sont
-- jamais concernées.
alter table public.profiles
  add column if not exists notify_confirmations boolean not null default true;
