-- SUIVI DE LIVRAISON DES CODES WHATSAPP (24 nov. 2026). Meta accepte un envoi puis peut ne pas le
-- livrer : le statut réel (sent, delivered, read, failed) arrive par webhook. `ref` = référence
-- aléatoire rendue au navigateur pour suivre SON envoi, sans exposer l'identifiant de ligne.
alter table public.auth_phone_codes
  add column if not exists wamid text,
  add column if not exists wa_status text,
  add column if not exists ref text;

create index if not exists auth_phone_codes_wamid_idx on public.auth_phone_codes (wamid) where wamid is not null;
create unique index if not exists auth_phone_codes_ref_idx on public.auth_phone_codes (ref) where ref is not null;
