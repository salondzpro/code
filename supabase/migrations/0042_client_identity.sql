-- 0042 — Identité d'un client chez un salon : une seule fiche par personne, et un blocage
-- qui suit cette identité (point 10 du plan de mise en production).
--
-- Jusqu'ici la clé d'un client était `coalesce(client_id, client_phone, lower(client_name))`.
-- Conséquence : un client reçu d'abord DE PASSAGE (le salon saisit nom + numéro), revenu ensuite
-- avec un COMPTE, apparaissait DEUX FOIS dans la clientèle — deux historiques, deux totaux dépensés,
-- deux blocs de notes, et l'anti-abus du salon lisait une moitié de son comportement.
--
-- Le numéro est ce qui traverse ce passage : il devient l'identité. Le compte ne sert plus qu'à lire
-- le numéro ACTUEL de la personne, de sorte qu'un numéro changé REGROUPE l'historique du compte au
-- lieu de le couper. Le compte reste la clé de repli pour un vieux profil sans numéro, et le nom
-- celle d'un client de passage dont le salon n'a pas noté le numéro.
--
-- Le blocage suit la même identité : `blocked_clients.client_key` permet enfin de bloquer un client
-- de passage connu par son seul nom. Les colonnes `client_id` / `phone` restent la clé de lecture de
-- `create_booking_multi` : un blocage reste opposable en ligne dès que la personne a un compte ou un
-- numéro — c'est-à-dire dans tous les cas où une réservation en ligne est possible. Un blocage sur
-- le seul nom est donc un repère pour le salon, pas une barrière technique : l'écran le dit.

-- ---------------------------------------------------------------------
-- 1) La formule, à un seul endroit.
-- ---------------------------------------------------------------------
create or replace function public.client_key(
  p_account_phone text,
  p_client_id uuid,
  p_client_phone text,
  p_client_name text
) returns text
language sql immutable parallel safe as $$
  select coalesce(
    nullif(trim(p_account_phone), ''),
    nullif(trim(p_client_phone), ''),
    p_client_id::text,
    lower(trim(coalesce(p_client_name, '')))
  )
$$;
comment on function public.client_key(text, uuid, text, text) is
  'Identité d''un client chez un salon : numéro actuel du compte, sinon numéro du rendez-vous, sinon compte, sinon nom.';
revoke execute on function public.client_key(text, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Les notes privées sont rangées par clé : les rattacher AVANT le changement de formule.
--    Deux fiches qui fusionnent avaient deux blocs de notes : on les recolle, la plus récente d'abord.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select n.salon_id, n.client_key as old_key, n.notes, n.updated_at,
      (select public.client_key(pr.phone, bk.client_id, bk.client_phone, bk.client_name)
         from public.bookings bk
         left join public.profiles pr on pr.id = bk.client_id
        where bk.salon_id = n.salon_id
          and coalesce(bk.client_id::text, bk.client_phone, lower(bk.client_name)) = n.client_key
        limit 1) as new_key
    from public.client_notes n
  loop
    -- Aucun rendez-vous ne porte plus cette clé (note orpheline) ou la clé ne bouge pas : on ne touche à rien.
    if r.new_key is null or r.new_key = r.old_key then
      continue;
    end if;
    delete from public.client_notes where salon_id = r.salon_id and client_key = r.old_key;
    insert into public.client_notes (salon_id, client_key, notes, updated_at)
    values (r.salon_id, r.new_key, r.notes, r.updated_at)
    on conflict (salon_id, client_key) do update
      set notes = left(client_notes.notes || E'\n\n' || excluded.notes, 2000),
          updated_at = greatest(client_notes.updated_at, excluded.updated_at);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) Blocage : par identité, en plus du compte et du numéro.
-- ---------------------------------------------------------------------
alter table public.blocked_clients add column if not exists client_key text;

-- La contrainte d'origine (sans nom) exigeait un compte OU un numéro : un client de passage sans
-- numéro n'était donc pas blocable. On l'ouvre à l'identité.
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.blocked_clients'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%client_id IS NOT NULL%';
  if c is not null then
    execute format('alter table public.blocked_clients drop constraint %I', c);
  end if;
end $$;
alter table public.blocked_clients
  add constraint blocked_clients_identity_check
  check (client_id is not null or phone is not null or client_key is not null);

-- Les blocages déjà posés reçoivent leur identité, pour que la fiche les retrouve par la clé aussi.
update public.blocked_clients bc
   set client_key = coalesce(
     (select public.client_key(pr.phone, bc.client_id, bc.phone, null)
        from public.profiles pr where pr.id = bc.client_id),
     public.client_key(null, bc.client_id, bc.phone, null))
 where bc.client_key is null;

-- Un même salon pouvait avoir bloqué la même personne deux fois (une ligne par compte, une par
-- numéro) : elles n'en font plus qu'une. On garde la plus ancienne, avec son motif.
delete from public.blocked_clients bc
 where exists (
   select 1 from public.blocked_clients keep
    where keep.salon_id = bc.salon_id
      and keep.client_key = bc.client_key
      and (keep.created_at, keep.id) < (bc.created_at, bc.id));

create unique index if not exists blocked_clients_salon_key_idx
  on public.blocked_clients (salon_id, client_key) where client_key is not null;

-- ---------------------------------------------------------------------
-- 4) Clientèle du salon : une ligne par personne.
-- ---------------------------------------------------------------------
create or replace function public.salon_clients_page(p_salon_id uuid, p_q text default null, p_key text default null, p_limit int default 30, p_offset int default 0)
returns table (
  client_key text, client_id uuid, name text, phone text, email text,
  bookings_count bigint, completed_count bigint, cancelled_count bigint, no_show_count bigint, spent_da bigint,
  last_at timestamptz, next_at timestamptz, last_booking_id uuid, blocked boolean, blocked_reason text, notes text,
  total_count bigint, blocked_count bigint
)
language sql stable security definer set search_path = public as $$
  with b as (
    select bk.*,
      public.client_key(pr.phone, bk.client_id, bk.client_phone, bk.client_name) as ckey,
      -- Numéro à afficher : celui du compte s'il y en a un (il est à jour), sinon celui du rendez-vous.
      coalesce(nullif(trim(pr.phone), ''), nullif(trim(bk.client_phone), '')) as best_phone
    from public.bookings bk
    left join public.profiles pr on pr.id = bk.client_id
    where bk.salon_id = p_salon_id
  ),
  agg as (
    select ckey,
      (array_agg(client_id) filter (where client_id is not null))[1] as client_id,
      (array_agg(client_name order by created_at desc))[1] as name,
      (array_agg(best_phone order by created_at desc) filter (where best_phone is not null))[1] as phone,
      count(*) filter (where status <> 'cancelled') as bookings_count,
      count(*) filter (where status = 'completed') as completed_count,
      count(*) filter (where status = 'cancelled' and cancellation_kind is null) as cancelled_count,
      count(*) filter (where status = 'no_show' or (status = 'cancelled' and cancellation_kind = 'late')) as no_show_count,
      coalesce(sum(price_da) filter (where status = 'completed'), 0)::bigint as spent_da,
      max(starts_at) filter (where starts_at <= now() and status <> 'cancelled') as last_at,
      min(starts_at) filter (where starts_at > now() and status in ('pending', 'confirmed')) as next_at,
      (array_agg(id order by (starts_at <= now()) desc, starts_at desc))[1] as last_booking_id
    from b group by ckey
  ),
  -- Bloqué chez CE salon : par identité, par compte ou par numéro (un blocage posé avant la fusion
  -- des fiches reste valable).
  flagged as (
    select a.*,
      (select bc.reason from public.blocked_clients bc
        where bc.salon_id = p_salon_id
          and (bc.client_key = a.ckey
               or (a.client_id is not null and bc.client_id = a.client_id)
               or (a.phone is not null and bc.phone = a.phone))
        order by bc.created_at limit 1) as blocked_reason,
      exists (select 1 from public.blocked_clients bc
        where bc.salon_id = p_salon_id
          and (bc.client_key = a.ckey
               or (a.client_id is not null and bc.client_id = a.client_id)
               or (a.phone is not null and bc.phone = a.phone))) as blocked
    from agg a
  )
  select f.ckey, f.client_id, f.name, f.phone,
    (select u.email from auth.users u where u.id = f.client_id and u.email not like '%@salondz.test') as email,
    f.bookings_count, f.completed_count, f.cancelled_count, f.no_show_count, f.spent_da,
    f.last_at, f.next_at, f.last_booking_id,
    f.blocked, f.blocked_reason,
    (select n.notes from public.client_notes n where n.salon_id = p_salon_id and n.client_key = f.ckey) as notes,
    count(*) over () as total_count,
    count(*) filter (where f.blocked) over () as blocked_count
  from flagged f
  where (p_key is null or f.ckey = p_key)
    and (p_q is null or p_q = ''
         or public.f_unaccent(f.name) ilike '%' || public.f_unaccent(p_q) || '%'
         or coalesce(f.phone, '') like '%' || regexp_replace(p_q, '\s', '', 'g') || '%')
  order by coalesce(f.next_at, f.last_at) desc nulls last, f.name
  limit greatest(1, least(coalesce(p_limit, 30), 100)) offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function public.salon_clients_page(uuid, text, text, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) Historique d'un client : même identité, donc l'historique fusionné est bien celui de la fiche.
-- ---------------------------------------------------------------------
create or replace function public.salon_client_history(
  p_salon_id uuid,
  p_client_key text,
  p_limit int default 50,
  p_offset int default 0,
  p_status public.booking_status default null
)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, service_name text, price_da int,
  status public.booking_status, cancelled_by public.cancelled_by, staff_name text, total bigint
)
language sql stable security definer set search_path = public as $$
  select bk.id, bk.starts_at, bk.ends_at, bk.service_name, bk.price_da, bk.status, bk.cancelled_by, st.display_name,
         count(*) over() as total
  from public.bookings bk
  left join public.staff st on st.id = bk.staff_id
  left join public.profiles pr on pr.id = bk.client_id
  where bk.salon_id = p_salon_id
    and public.client_key(pr.phone, bk.client_id, bk.client_phone, bk.client_name) = p_client_key
    and (p_status is null or bk.status = p_status)
  order by bk.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function public.salon_client_history(uuid, text, int, int, public.booking_status) from public, anon, authenticated;
