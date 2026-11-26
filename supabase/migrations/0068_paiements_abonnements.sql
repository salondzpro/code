-- PAIEMENT DES ABONNEMENTS PAR CHARGILY PAY (26 nov. 2026, demande du propriétaire).
--
-- Une ligne par paiement LANCÉ par un professionnel (carte CIB ou Edahabia, page de paiement Chargily).
-- Le montant et la durée sont calculés par l'API, jamais lus du navigateur ; l'abonnement n'est
-- prolongé qu'à la réception d'un webhook SIGNÉ, confirmé par une relecture du paiement chez Chargily
-- (statut « paid », même montant, même mode test/production). `chargily_checkout_id` unique et la
-- transition `pending → paid` faite une seule fois : un webhook rejoué ne prolonge jamais deux fois.

create table if not exists public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  plan text not null check (plan in ('pro', 'salon')),
  months int not null check (months in (1, 12)),
  amount_da int not null check (amount_da >= 50),
  livemode boolean not null default false,
  chargily_checkout_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled', 'expired')),
  -- Échéance de l'abonnement APRÈS ce paiement (posée au moment où il est encaissé).
  plan_until date,
  paid_at timestamptz,
  last_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_payments_salon_idx on public.plan_payments (salon_id, created_at desc);

-- Seule l'API (clé secrète) lit et écrit les paiements.
alter table public.plan_payments enable row level security;
revoke all on public.plan_payments from anon, authenticated;
