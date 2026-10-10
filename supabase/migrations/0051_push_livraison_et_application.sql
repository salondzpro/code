-- Notifications poussées : LIVRAISON TRAÇABLE et IDENTITÉ DE L'APPLICATION (10 oct. 2026).
--
-- 1) `pushed_at` était posé APRÈS l'envoi, à la fin du lot. Deux envois pouvaient donc se chevaucher
--    (l'appel qui suit une réservation, le cron, la liste d'attente) et lire les MÊMES lignes « non
--    poussées » : la même notification partait deux fois sur le téléphone. Le lot se RÉSERVE
--    désormais d'abord (`pushed_at` posé dans la même instruction que la lecture), puis s'envoie.
--    Trois colonnes disent ce qu'il est advenu de chaque notification :
--      - `push_outcome` : `sent` (acceptée par au moins un fournisseur), `no_device` (aucun appareil
--        joignable), `opted_out` (réglage du client), `failed` (tous les fournisseurs ont échoué de
--        façon passagère, après `push_attempts` essais) ;
--      - `push_attempts` : nombre de tentatives, pour borner les reprises ;
--      - `push_error` : dernière erreur, courte, sans donnée personnelle.
--    Une notification est CRÉÉE (ligne), puis ACCEPTÉE par le fournisseur (`sent`), ce qui n'est
--    toujours pas une preuve qu'elle a été vue : seule la lecture (`read_at`) le dit.
--
-- 2) `push_tokens.app_id` : l'application qui a enregistré le jeton. Un iPhone rend un jeton APNs
--    brut, identique de forme pour l'application grand public (`dz.salondz.app`) et pour
--    l'application professionnelle (`pro.salondz.app`) — or Apple exige le `apns-topic` de la BONNE
--    application, sinon `TopicDisallowed` et le jeton serait jeté comme mort. Nul pour les jetons
--    déjà en base (grand public, le seul à exister avant cette migration) et pour le navigateur.

alter table public.notifications
  add column if not exists push_outcome text
    check (push_outcome in ('sent', 'no_device', 'opted_out', 'failed')),
  add column if not exists push_attempts smallint not null default 0,
  add column if not exists push_error text;

alter table public.push_tokens
  add column if not exists app_id text
    check (app_id in ('dz.salondz.app', 'pro.salondz.app'));

-- L'index partiel des « non poussées » reste valable : une reprise remet `pushed_at` à null.
comment on column public.notifications.push_outcome is 'sent | no_device | opted_out | failed — issue de la dernière tentative d''envoi (lib/push.ts)';
comment on column public.push_tokens.app_id is 'Application qui a enregistré le jeton (APNs : sert de apns-topic)';
