-- Temps réel : garantir que les tables écoutées sont réellement publiées.
--
-- 0001 les ajoutait sous condition (« si la publication supabase_realtime existe déjà »).
-- Sur un projet où la publication n'existait pas encore au moment de l'initialisation, le bloc
-- était un no-op silencieux : les clients s'abonnent, le canal passe à SUBSCRIBED, et pourtant
-- aucun événement n'arrive jamais. C'est exactement le symptôme « je ne vois la réservation
-- qu'après avoir actualisé la page ».
--
-- Ici on rend l'état déterministe, sans condition d'existence préalable, et de façon idempotente :
-- si tout est déjà en place, cette migration ne change rien.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Note volontaire : on garde l'identité de réplique par défaut. Passer les tables en
-- « replica identity full » ferait grossir le WAL pour chaque mise à jour alors que le client
-- n'a besoin que de savoir QUE quelque chose a changé, jamais de l'ancienne version de la ligne.
