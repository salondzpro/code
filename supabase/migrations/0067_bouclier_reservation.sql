-- BOUCLIER DE RÉSERVATION (26 nov. 2026, demande du propriétaire) : journal des TENTATIVES de
-- réservation en ligne, lu par le moteur de fraude de l'API (`lib/fraud.ts`) pour mesurer la vitesse
-- d'un compte, les rafales depuis une même adresse et les refus répétés. Chaque ligne garde aussi le
-- score et ses raisons : une suspension automatique doit pouvoir s'expliquer après coup.
-- Lignes purgées au bout de 30 jours par le cron (pas une archive).

create table if not exists public.booking_attempts (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  salon_id uuid references public.salons (id) on delete cascade,
  ip text,
  outcome text not null check (outcome in ('ok', 'refused', 'blocked')),
  score int not null default 0,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists booking_attempts_user_idx on public.booking_attempts (user_id, created_at desc);
create index if not exists booking_attempts_ip_idx on public.booking_attempts (ip, created_at desc);

-- Seule l'API (clé secrète) lit et écrit ce journal.
alter table public.booking_attempts enable row level security;
revoke all on public.booking_attempts from anon, authenticated;
