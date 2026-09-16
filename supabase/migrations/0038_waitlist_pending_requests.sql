-- Liste d'attente « créneau libéré » et demandes en attente (validation manuelle) — 16 sept. 2026.
-- Étude façon Planity : un créneau demandé est bloqué pour les autres tant que le salon n'a pas répondu
-- (déjà le cas : les demandes `pending` occupent le créneau) ; le salon a un délai pour répondre, sinon
-- la demande expire et libère le créneau ; un client peut s'inscrire pour être prévenu si un créneau
-- se libère un jour donné ; les clients ayant un rendez-vous plus tard sont prévenus d'un créneau plus tôt.

-- Nouveaux types de notification (valeurs ajoutées hors de tout usage dans ce fichier).
alter type public.notification_type add value if not exists 'slot_freed';
alter type public.notification_type add value if not exists 'request_pending';

-- Relance du professionnel sur une demande sans réponse : une seule fois.
alter table public.bookings add column if not exists pro_reminded_at timestamptz;
create index if not exists bookings_pending_reminder_idx on public.bookings (created_at)
  where status = 'pending' and pro_reminded_at is null;

-- Alertes « prévenez-moi si un créneau se libère » : un client, un salon, un jour.
create table if not exists public.slot_alerts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  day date not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (salon_id, client_id, day)
);
create index if not exists slot_alerts_open_idx on public.slot_alerts (salon_id, day) where notified_at is null;
alter table public.slot_alerts enable row level security;
-- Aucune policy : seule l'API (clé secrète) lit et écrit.
revoke all on public.slot_alerts from anon, authenticated;
