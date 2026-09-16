-- Durcissement avant ouverture au public (16 sept. 2026) — audit sécurité / règles de gestion.

-- 1) Recherche d'un compte par e-mail sans lister tous les comptes (l'API le faisait via
--    auth.admin.listUsers, plafonné à 1 000 : au-delà, un vrai compte était « introuvable »).
--    Réservée à la clé secrète : révoquée pour anon et authenticated.
create or replace function public.auth_user_by_email(p_email text)
returns table (id uuid, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, u.email_confirmed_at, u.raw_user_meta_data
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;
revoke all on function public.auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_by_email(text) to service_role;

-- 2) Index manquants sur le chemin de la réservation et de la fiche client.
create index if not exists bookings_client_phone_idx on public.bookings (client_phone) where client_phone is not null;
create index if not exists bookings_booked_by_idx on public.bookings (booked_by) where booked_by is not null;
create index if not exists bookings_service_id_idx on public.bookings (service_id);
create index if not exists booking_items_service_id_idx on public.booking_items (service_id);
create index if not exists reviews_client_id_idx on public.reviews (client_id);
create index if not exists profiles_phone_idx on public.profiles (phone) where phone is not null;

-- 3) Le numéro de profil est une clé d'identité (règles anti-abus, fiches clients) : format E.164
--    algérien imposé aux nouvelles écritures (NOT VALID : les lignes existantes ne bloquent pas).
alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format
  check (phone is null or phone ~ '^\+213[5-7][0-9]{8}$') not valid;

-- 4) Un rendez-vous déplacé redevient à rappeler : sans cela, le report d'un rendez-vous déjà rappelé
--    n'entraînait plus aucun rappel pour le nouveau créneau.
create or replace function public.reset_reminder_on_move()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end $$;
drop trigger if exists bookings_reset_reminder_on_move on public.bookings;
create trigger bookings_reset_reminder_on_move
  before update of starts_at on public.bookings
  for each row execute function public.reset_reminder_on_move();

-- 5) Jour de repos d'un membre respecté. Avant : un jour sans ligne staff_hours retombait sur les
--    horaires du salon, donc « Repos » (aucune ligne ce jour-là) laissait le membre réservable.
--    Désormais : un membre qui a des horaires personnalisés (au moins une ligne, n'importe quel jour)
--    n'est réservable QUE sur ses lignes ; seul un membre sans aucun horaire propre suit le salon.
create or replace function public.get_available_slots_for(
  p_salon_id uuid,
  p_duration_minutes int,
  p_date date,
  p_staff_id uuid default null,
  p_enforce_lead_time boolean default true,
  p_exclude_booking uuid default null,
  p_service_ids uuid[] default null
)
returns table (slot_start timestamptz, staff_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_salon public.salons%rowtype;
  v_dow int;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_min_start timestamptz;
  v_duration interval;
  v_step interval;
  v_buffer interval;
begin
  select * into v_salon from public.salons where id = p_salon_id;
  if not found then return; end if;
  if p_duration_minutes is null or p_duration_minutes <= 0 then return; end if;

  v_dow := extract(dow from p_date)::int; -- 0 = dimanche
  v_day_start := (p_date::timestamp) at time zone 'Africa/Algiers';
  v_day_end := v_day_start + interval '1 day';
  v_duration := make_interval(mins => p_duration_minutes);
  v_step := make_interval(mins => v_salon.slot_interval_minutes);
  v_buffer := make_interval(mins => coalesce(v_salon.buffer_minutes, 0));
  v_min_start := case when p_enforce_lead_time
    then now() + make_interval(mins => v_salon.booking_lead_time_minutes)
    else now() - interval '1 day' end;

  return query
  with staff_set as (
    select s.id
    from public.staff s
    where s.salon_id = p_salon_id and s.is_active
      and (p_staff_id is null or s.id = p_staff_id)
      and (p_service_ids is null or s.all_services or not exists (
        select 1 from unnest(p_service_ids) as req(service_id)
        where not exists (select 1 from public.staff_services ss where ss.staff_id = s.id and ss.service_id = req.service_id)
      ))
  ),
  windows as (
    -- Membre avec horaires personnalisés : ses plages du jour, bornées par l'ouverture du salon.
    select ss.id as sid,
           greatest(v_day_start + sh.starts_at::interval, v_day_start + oh.opens_at::interval) as win_start,
           least(v_day_start + sh.ends_at::interval, v_day_start + oh.closes_at::interval) as win_end
    from staff_set ss
    join public.staff_hours sh on sh.staff_id = ss.id and sh.day_of_week = v_dow
    join public.opening_hours oh on oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
    where sh.starts_at < oh.closes_at and sh.ends_at > oh.opens_at
    union all
    -- Membre SANS aucun horaire personnalisé : horaires du salon.
    select ss.id,
           v_day_start + oh.opens_at::interval,
           v_day_start + oh.closes_at::interval
    from staff_set ss
    join public.opening_hours oh on oh.salon_id = p_salon_id and oh.day_of_week = v_dow and not oh.is_closed
    where not exists (select 1 from public.staff_hours sh where sh.staff_id = ss.id)
  ),
  candidates as (
    select w.sid, gs as s_start
    from windows w
    cross join lateral generate_series(w.win_start, w.win_end - v_duration, v_step) as gs
  ),
  busy as (
    select b.staff_id as sid, tstzrange(b.starts_at - v_buffer, b.ends_at + v_buffer, '[)') as r
    from public.bookings b
    where b.salon_id = p_salon_id and b.status in ('pending', 'confirmed')
      and b.starts_at < v_day_end and b.ends_at > v_day_start
      and b.id is distinct from p_exclude_booking
    union all
    select tb.staff_id, tstzrange(tb.starts_at, tb.ends_at, '[)')
    from public.time_blocks tb
    where tb.salon_id = p_salon_id and tb.starts_at < v_day_end and tb.ends_at > v_day_start
  )
  select distinct c.s_start, c.sid
  from candidates c
  where c.s_start >= v_min_start
    and not exists (
      select 1 from busy b
      where (b.sid is null or b.sid = c.sid)
        and b.r && tstzrange(c.s_start, c.s_start + v_duration, '[)')
    )
  order by c.s_start, c.sid;
end $$;
grant execute on function public.get_available_slots_for(uuid, int, date, uuid, boolean, uuid, uuid[]) to anon, authenticated;

-- 6) Déchets techniques du cron : les réponses pg_net et l'historique pg_cron ne servent à rien après
--    quelques jours et grossissent à chaque tick (toutes les 10 min).
create or replace function public.purge_cron_leftovers()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from net._http_response where created < now() - interval '7 days';
  delete from cron.job_run_details where end_time < now() - interval '30 days';
exception when others then
  null; -- extensions absentes en local : sans conséquence
end $$;
revoke all on function public.purge_cron_leftovers() from public, anon, authenticated;
select cron.schedule('salondz-purge-leftovers', '17 3 * * *', $$select public.purge_cron_leftovers()$$)
where not exists (select 1 from cron.job where jobname = 'salondz-purge-leftovers');
