-- 0015 — Fiche client complète côté pro : e-mail, montant dépensé, notes privées du salon, historique détaillé.

-- 1) Notes privées du salon sur un client (jamais visibles du client).
create table if not exists public.client_notes (
  salon_id uuid not null references public.salons (id) on delete cascade,
  client_key text not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (salon_id, client_key)
);
alter table public.client_notes enable row level security;

-- 2) Fiche agrégée : + e-mail du compte, montant dépensé (rendez-vous terminés), notes.
drop function if exists public.salon_clients(uuid);
create or replace function public.salon_clients(p_salon_id uuid)
returns table (
  client_key text, client_id uuid, name text, phone text, email text,
  bookings_count bigint, completed_count bigint, cancelled_count bigint, no_show_count bigint, spent_da bigint,
  last_at timestamptz, next_at timestamptz, last_booking_id uuid, blocked boolean, blocked_reason text, notes text
)
language sql stable security definer set search_path = public as $$
  with b as (
    select bk.*, coalesce(bk.client_id::text, bk.client_phone, lower(bk.client_name)) as ckey
    from public.bookings bk
    where bk.salon_id = p_salon_id
  ),
  agg as (
    select ckey,
      (array_agg(client_id) filter (where client_id is not null))[1] as client_id,
      (array_agg(client_name order by created_at desc))[1] as name,
      (array_agg(client_phone) filter (where client_phone is not null))[1] as phone,
      count(*) filter (where status <> 'cancelled') as bookings_count,
      count(*) filter (where status = 'completed') as completed_count,
      count(*) filter (where status = 'cancelled') as cancelled_count,
      count(*) filter (where status = 'no_show') as no_show_count,
      coalesce(sum(price_da) filter (where status = 'completed'), 0)::bigint as spent_da,
      max(starts_at) filter (where starts_at <= now() and status <> 'cancelled') as last_at,
      min(starts_at) filter (where starts_at > now() and status in ('pending', 'confirmed')) as next_at,
      (array_agg(id order by (starts_at <= now()) desc, starts_at desc))[1] as last_booking_id
    from b group by ckey
  )
  select a.ckey, a.client_id, a.name, a.phone,
    (select u.email from auth.users u where u.id = a.client_id and u.email not like '%@salondz.test') as email,
    a.bookings_count, a.completed_count, a.cancelled_count, a.no_show_count, a.spent_da,
    a.last_at, a.next_at, a.last_booking_id,
    exists (select 1 from public.blocked_clients bc where bc.salon_id = p_salon_id
            and ((a.client_id is not null and bc.client_id = a.client_id) or (a.phone is not null and bc.phone = a.phone))) as blocked,
    (select bc.reason from public.blocked_clients bc where bc.salon_id = p_salon_id
            and ((a.client_id is not null and bc.client_id = a.client_id) or (a.phone is not null and bc.phone = a.phone)) limit 1) as blocked_reason,
    (select n.notes from public.client_notes n where n.salon_id = p_salon_id and n.client_key = a.ckey) as notes
  from agg a
  order by coalesce(a.next_at, a.last_at) desc nulls last, a.name
$$;
revoke execute on function public.salon_clients(uuid) from public, anon, authenticated;

-- 3) Historique d'un client chez ce salon (du plus récent au plus ancien).
create or replace function public.salon_client_history(p_salon_id uuid, p_client_key text)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, service_name text, price_da int,
  status public.booking_status, cancelled_by public.cancelled_by, staff_name text
)
language sql stable security definer set search_path = public as $$
  select bk.id, bk.starts_at, bk.ends_at, bk.service_name, bk.price_da, bk.status, bk.cancelled_by, st.display_name
  from public.bookings bk
  left join public.staff st on st.id = bk.staff_id
  where bk.salon_id = p_salon_id
    and coalesce(bk.client_id::text, bk.client_phone, lower(bk.client_name)) = p_client_key
  order by bk.starts_at desc
  limit 200
$$;
revoke execute on function public.salon_client_history(uuid, text) from public, anon, authenticated;
