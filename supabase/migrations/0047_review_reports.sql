-- 0047 — Signalement d'un avis par un utilisateur.
--
-- Les avis sont du contenu écrit par des utilisateurs, publié à la vue de tous. Apple (guideline 1.2) et
-- Google Play attendent d'une application qui en montre : un moyen de SIGNALER un contenu abusif, une
-- réponse en temps utile, et un contact publié. L'administration savait déjà MASQUER un avis (migration
-- 0045) ; il manquait le canal par lequel on lui signale lequel. Sans lui, tout arrivait par e-mail, sans
-- suivi.
--
-- Un signalement est unique par personne et par avis (on ne gonfle pas un compteur en cliquant dix fois), il
-- ne supprime rien et ne masque rien à lui seul : c'est un opérateur qui décide, avec un motif, et le
-- signalement est ensuite classé (`handled` ou `rejected`).

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  /** offensive : injurieux ou haineux · false : faux avis (pas un client) · private : données personnelles · other */
  reason text not null check (reason in ('offensive', 'false', 'private', 'other')),
  message text check (message is null or char_length(message) <= 300),
  status text not null default 'open' check (status in ('open', 'handled', 'rejected')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);
create index if not exists review_reports_open_idx on public.review_reports (created_at desc) where status = 'open';

-- Comme les tables d'administration : RLS activée SANS politique et aucun droit pour la clé publique.
-- Seule l'API (clé secrète) écrit et lit ici — un signalement n'est jamais lisible par celui qu'il vise.
alter table public.review_reports enable row level security;
revoke all on public.review_reports from anon, authenticated;
