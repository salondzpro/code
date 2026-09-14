-- Purge des notifications par le cron (/internal/cron/tick) : lues depuis plus de
-- NOTIFICATION_READ_TTL_DAYS jours, ou créées depuis plus de NOTIFICATION_MAX_AGE_DAYS jours
-- (valeurs dans packages/constants). Ces deux suppressions balaient la table par read_at et
-- created_at : un index partiel sur les lues évite un parcours complet à chaque passage.
create index if not exists notifications_read_idx
  on public.notifications (read_at)
  where read_at is not null;
