-- CODES DE CONNEXION PAR WHATSAPP (23 nov. 2026, demande du propriétaire : « sécurisé comme Uber »).
--
-- Chaque envoi est une ligne : le code n'est JAMAIS stocké en clair (HMAC calculé par l'API avec une
-- clé dérivée du secret serveur). Les lignes servent aussi de compteurs : délais entre deux envois,
-- plafonds par numéro, par adresse IP et pour toute la plateforme (chaque message WhatsApp est
-- facturé — c'est la parade contre le « SMS pumping » des robots).
--
-- Table et fonction réservées à l'API (clé secrète) : RLS sans politique, droits retirés.

create table if not exists public.auth_phone_codes (
  id bigserial primary key,
  phone text not null,
  role text not null check (role in ('client', 'pro')),
  code_hash text not null,
  ip text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  delivered boolean not null default true
);

create index if not exists auth_phone_codes_phone_idx on public.auth_phone_codes (phone, created_at desc);
create index if not exists auth_phone_codes_ip_idx on public.auth_phone_codes (ip, created_at desc);
create index if not exists auth_phone_codes_created_idx on public.auth_phone_codes (created_at);

alter table public.auth_phone_codes enable row level security;
revoke all on public.auth_phone_codes from public, anon, authenticated;
revoke all on sequence public.auth_phone_codes_id_seq from public, anon, authenticated;

-- Vérifie le DERNIER code actif d'un numéro pour un portail, en une transaction (verrou de ligne) :
--   'ok'       bon code, désormais consommé (un code ne sert qu'une fois)
--   'invalid'  mauvais code, un essai de moins
--   'locked'   trop d'essais sur ce code : il faut en redemander un
--   'expired'  code périmé
--   'none'     aucun code demandé
create or replace function public.auth_phone_code_check(p_phone text, p_role text, p_hash text, p_max int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.auth_phone_codes%rowtype;
begin
  select * into r
    from public.auth_phone_codes
   where phone = p_phone and role = p_role and consumed_at is null and delivered
   order by created_at desc
   limit 1
   for update;
  if not found then return 'none'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  if r.attempts >= p_max then return 'locked'; end if;
  if r.code_hash = p_hash then
    update public.auth_phone_codes set consumed_at = now() where id = r.id;
    return 'ok';
  end if;
  update public.auth_phone_codes set attempts = attempts + 1 where id = r.id;
  return case when r.attempts + 1 >= p_max then 'locked' else 'invalid' end;
end;
$$;

revoke execute on function public.auth_phone_code_check(text, text, text, int) from public, anon, authenticated;
