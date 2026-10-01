-- IDEMPOTENCE DES ÉCRITURES.
--
-- Pourquoi : sur un réseau mobile algérien, une requête part, le serveur l'exécute, et la réponse
-- se perd en chemin. Le téléphone croit à un échec et réessaie — et l'on crée deux rendez-vous,
-- deux comptes, deux salons. Le défaut ne se voit jamais en test, seulement chez les gens.
--
-- Principe : chaque écriture porte une `Idempotency-Key` générée par le client. La première
-- requête qui présente cette clé s'exécute et sa réponse est CONSERVÉE ; toute reprise de la même
-- clé reçoit la réponse d'origine sans rien réexécuter. Le client peut donc réessayer sans risque.
--
-- La clé est liée à l'utilisateur, à la méthode, au chemin ET à une empreinte du corps : présenter
-- la même clé avec un corps différent est une faute d'appel, pas une reprise — on la refuse.

create table if not exists public.idempotency_keys (
  key text primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  method text not null,
  path text not null,
  -- Empreinte du corps : une même clé avec un corps différent n'est PAS une reprise.
  fingerprint text not null,
  -- Nul tant que la requête est en cours : une reprise arrivée entre-temps doit attendre plutôt
  -- que de relancer le travail en parallèle.
  status int,
  response jsonb,
  created_at timestamptz not null default now()
);

-- Purge : une clé ne sert qu'au temps des reprises. 24 h couvrent très largement un réseau capricieux.
create index if not exists idempotency_keys_created_idx on public.idempotency_keys (created_at);

-- Table de service : seule l'API y touche (clé secrète). Aucune politique, aucun droit délégué.
alter table public.idempotency_keys enable row level security;
revoke all on public.idempotency_keys from anon, authenticated;
