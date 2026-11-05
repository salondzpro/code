-- Provenance d'une réservation (5 nov. 2026) : le pro et l'administration voient si le rendez-vous vient
-- d'Instagram, de Snapchat, du code QR ou du lien. On garde le réseau, jamais l'identité de la personne
-- sur ce réseau : Instagram et Snapchat ne la transmettent pas.
--
-- Snapchat rejoint aussi le compteur anonyme des visites.

alter table public.salon_page_views drop constraint if exists salon_page_views_source_check;
alter table public.salon_page_views
  add constraint salon_page_views_source_check check (source in ('link', 'instagram', 'snapchat', 'qr', 'other'));

create or replace function public.record_page_view(p_salon_id uuid, p_source text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.salon_page_views (salon_id, day, source, views)
  values (
    p_salon_id,
    (now() at time zone 'Africa/Algiers')::date,
    case when p_source in ('link', 'instagram', 'snapchat', 'qr') then p_source else 'other' end,
    1
  )
  on conflict (salon_id, day, source) do update set views = public.salon_page_views.views + 1;
$$;

revoke execute on function public.record_page_view(uuid, text) from public, anon, authenticated;

alter table public.bookings
  add column if not exists origin text check (origin in ('link', 'instagram', 'snapchat', 'qr'));
