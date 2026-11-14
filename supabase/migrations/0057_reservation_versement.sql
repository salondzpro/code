-- RÉSERVATION AVEC VERSEMENT (14 nov. 2026, demande du propriétaire).
--
-- Le professionnel peut exiger un versement pour réserver en ligne : un MONTANT FIXE ou un POURCENTAGE
-- du total, pour toutes les clientes ou les nouvelles seulement. Il indique son compte (CCP, RIB
-- bancaire, BaridiMob) ; la cliente fait le virement, joint la capture ou le PDF du reçu, et le salon
-- valide le justificatif — c'est cette validation qui confirme le rendez-vous. Tout est retracé sur le
-- rendez-vous : montant, état, dates d'envoi et de décision, motif d'un refus.
--
-- Les coordonnées du compte ne sont JAMAIS publiques : l'API ne les rend qu'au propriétaire et à la
-- cliente d'un rendez-vous qui attend son versement. Les justificatifs vont dans un seau PRIVÉ, sans
-- politique : seule l'API (clé secrète) y lit et y écrit, par adresses signées de courte durée.

alter table public.salons
  add column if not exists deposit_mode text not null default 'off'
    check (deposit_mode in ('off', 'fixed', 'percent')),
  add column if not exists deposit_value integer not null default 0
    check (deposit_value >= 0 and deposit_value <= 1000000),
  add column if not exists deposit_scope text not null default 'all'
    check (deposit_scope in ('all', 'new'));

-- Le COMPTE du salon vit à part : `salons` est lisible avec la clé publique (place de marché), un RIB
-- n'a rien à y faire. RLS activée SANS politique et droits retirés : seule l'API le lit.
create table if not exists public.salon_deposit_accounts (
  salon_id uuid primary key references public.salons (id) on delete cascade,
  method text not null default 'ccp' check (method in ('ccp', 'bank', 'baridimob')),
  holder text check (char_length(holder) <= 80),
  account text check (char_length(account) <= 60),
  note text check (char_length(note) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.salon_deposit_accounts enable row level security;
revoke all on public.salon_deposit_accounts from public, anon, authenticated;

alter table public.salons
  add constraint salons_deposit_percent_max check (deposit_mode <> 'percent' or deposit_value <= 100);

alter table public.bookings
  add column if not exists deposit_amount integer check (deposit_amount > 0),
  add column if not exists deposit_status text
    check (deposit_status in ('awaiting', 'submitted', 'accepted', 'rejected')),
  add column if not exists deposit_proof_path text,
  add column if not exists deposit_proof_type text,
  add column if not exists deposit_submitted_at timestamptz,
  add column if not exists deposit_reviewed_at timestamptz,
  add column if not exists deposit_reject_reason text check (char_length(deposit_reject_reason) <= 200);

create index if not exists bookings_deposit_submitted_idx
  on public.bookings (salon_id, deposit_submitted_at) where deposit_status = 'submitted';

-- Seau PRIVÉ des justificatifs : 8 Mo, images et PDF. Aucune politique : ni la clé publique ni un
-- compte connecté n'y accèdent directement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deposits', 'deposits', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- create or replace (même signature) : les privilèges posés en 0045/0052 sont conservés.
create or replace function public.create_booking_multi(
  p_salon_id uuid,
  p_service_ids uuid[],
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_client_id uuid,
  p_client_name text,
  p_client_phone text default null,
  p_notes text default null,
  p_source public.booking_source default 'online',
  p_enforce_rules boolean default true
)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_salon public.salons%rowtype;
  v_booking public.bookings%rowtype;
  v_total record;
  v_local_date date;
  v_today date;
  v_ends timestamptz;
  v_candidates uuid[];
  v_staff uuid;
  v_status public.booking_status;
  v_dow int;
  v_first uuid;
  v_constraint text;
  v_deposit integer;
begin
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'SERVICE_INACTIVE' using errcode = 'P0001';
  end if;
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then
    raise exception 'SALON_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Suspension par la PLATEFORME : elle s'applique aussi à la saisie du salon lui-même, sinon la
  -- porte de derrière annule la décision. Elle ne bloque que la création : confirmer, terminer ou
  -- annuler un rendez-vous déjà pris reste possible, c'est ainsi qu'on solde proprement.
  if v_salon.suspended_at is not null then
    raise exception 'SALON_SUSPENDED' using errcode = 'P0001';
  end if;
  select * into v_total from public.services_total(p_salon_id, p_service_ids);
  if v_total.n <> array_length(p_service_ids, 1) then
    raise exception 'SERVICE_INACTIVE' using errcode = 'P0001';
  end if;
  v_first := p_service_ids[1];

  v_ends := p_starts_at + make_interval(mins => v_total.duration_minutes);
  v_local_date := (p_starts_at at time zone 'Africa/Algiers')::date;
  v_today := (now() at time zone 'Africa/Algiers')::date;
  v_dow := extract(dow from v_local_date)::int;

  if p_enforce_rules then
    if not v_salon.is_published then
      raise exception 'SALON_NOT_PUBLISHED' using errcode = 'P0001';
    end if;
    -- Client suspendu par la plateforme : plus de réservation EN LIGNE, nulle part. Reçu en
    -- personne au salon, il reste l'affaire du salon — d'où la place de ce test, sous les règles.
    if p_client_id is not null and exists (
      select 1 from public.profiles pr where pr.id = p_client_id and pr.suspended_at is not null
    ) then
      raise exception 'CLIENT_SUSPENDED' using errcode = 'P0001';
    end if;
    -- Client bloqué par ce salon (par compte ou par numéro) : pas de réservation en ligne chez lui.
    if exists (
      select 1 from public.blocked_clients bc
      where bc.salon_id = p_salon_id
        and ((p_client_id is not null and bc.client_id = p_client_id)
             or (p_client_phone is not null and bc.phone = p_client_phone))
    ) then
      raise exception 'CLIENT_BLOCKED' using errcode = 'P0001';
    end if;
    if p_starts_at < now() then
      raise exception 'IN_PAST' using errcode = 'P0001';
    end if;
    if p_starts_at < now() + make_interval(mins => v_salon.booking_lead_time_minutes) then
      raise exception 'TOO_SOON' using errcode = 'P0001';
    end if;
    if v_local_date > v_today + v_salon.booking_horizon_days then
      raise exception 'TOO_FAR' using errcode = 'P0001';
    end if;
    if p_staff_id is not null and not exists (
      select 1 from public.staff where id = p_staff_id and salon_id = p_salon_id and is_active
    ) then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;

    select array_agg(a.staff_id order by st.sort_order, st.created_at) into v_candidates
    from public.get_available_slots_for(p_salon_id, v_total.duration_minutes, v_local_date, p_staff_id, true, null, p_service_ids) a
    join public.staff st on st.id = a.staff_id
    where a.slot_start = p_starts_at;

    if v_candidates is null then
      if not exists (
        select 1 from public.opening_hours oh
        where oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
          and (p_starts_at at time zone 'Africa/Algiers')::time >= oh.opens_at
          and (v_ends at time zone 'Africa/Algiers')::time <= oh.closes_at
      ) then
        raise exception 'OUTSIDE_OPENING_HOURS' using errcode = 'P0001';
      end if;
      raise exception 'SLOT_TAKEN' using errcode = 'P0001';
    end if;
  else
    if p_staff_id is null then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;
    select array[s.id] into v_candidates from public.staff s
      where s.id = p_staff_id and s.salon_id = p_salon_id and s.is_active
        and (s.all_services or not exists (
          select 1 from unnest(p_service_ids) as req(service_id)
          where not exists (select 1 from public.staff_services ss where ss.staff_id = s.id and ss.service_id = req.service_id)));
    if v_candidates is null then
      raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  -- VERSEMENT (0057) : réservation EN LIGNE d'un salon qui demande un versement — montant fixe ou
  -- pourcentage du total (arrondi à la dizaine supérieure, jamais plus que le total), à tous ou aux
  -- nouvelles clientes seulement (aucun rendez-vous TERMINÉ chez ce salon, par compte ou par numéro).
  -- Le rendez-vous reste alors une DEMANDE, qui bloque le créneau, jusqu'à ce que le salon valide le
  -- justificatif — même si le salon confirme d'office d'habitude.
  v_deposit := null;
  if p_source = 'online' and p_enforce_rules and v_salon.deposit_mode in ('fixed', 'percent')
     and coalesce(v_salon.deposit_value, 0) > 0 and coalesce(v_total.price_da, 0) > 0
     and (v_salon.deposit_scope = 'all' or not exists (
       select 1 from public.bookings ob
       where ob.salon_id = p_salon_id and ob.status = 'completed'
         and ((p_client_id is not null and ob.client_id = p_client_id)
              or (p_client_phone is not null and ob.client_phone = p_client_phone)))) then
    v_deposit := least(
      v_total.price_da,
      case when v_salon.deposit_mode = 'fixed' then v_salon.deposit_value
           else (ceil(v_total.price_da * v_salon.deposit_value / 1000.0) * 10)::int end);
  end if;

  v_status := case
    when v_deposit is not null then 'pending'::public.booking_status
    when p_source <> 'online' or v_salon.auto_confirm then 'confirmed'::public.booking_status
    else 'pending'::public.booking_status end;

  foreach v_staff in array v_candidates loop
    begin
      insert into public.bookings (
        salon_id, client_id, staff_id, service_id, service_name, duration_minutes, price_da,
        starts_at, ends_at, status, source, client_name, client_phone, notes,
        deposit_amount, deposit_status
      ) values (
        p_salon_id, p_client_id, v_staff, v_first, v_total.label, v_total.duration_minutes,
        v_total.price_da, p_starts_at, v_ends, v_status, p_source, p_client_name, p_client_phone, p_notes,
        v_deposit, case when v_deposit is null then null else 'awaiting' end
      )
      returning * into v_booking;

      insert into public.booking_items (booking_id, service_id, service_name, duration_minutes, price_da, sort_order)
      select v_booking.id, sv.id, sv.name, sv.duration_minutes, sv.price_da, ord.i
      from unnest(p_service_ids) with ordinality as ord(id, i)
      join public.services sv on sv.id = ord.id;

      return v_booking;
    exception when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_client_no_overlap' then
        raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
      end if;
      null; -- course perdue sur ce membre : membre suivant
    end;
  end loop;

  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;

revoke execute on function public.create_booking_multi(uuid, uuid[], uuid, timestamptz, uuid, text, text, text, public.booking_source, boolean) from public, anon, authenticated;
