-- Provenance « place de marché » (13 nov. 2026, demande du propriétaire) : distinguer les visites et
-- les réservations APPORTÉES PAR SALON DZ (page du salon ouverte en naviguant dans Salon DZ : recherche,
-- carte, favoris, mes rendez-vous) de celles venues d'un lien partagé, d'Instagram, de Snapchat ou du
-- code QR. Le professionnel voit ainsi ce que la place de marché lui rapporte.
--
-- Toujours le réseau, jamais la personne : aucune donnée personnelle de plus.

alter table public.salon_page_views drop constraint if exists salon_page_views_source_check;
alter table public.salon_page_views
  add constraint salon_page_views_source_check
  check (source in ('link', 'instagram', 'snapchat', 'qr', 'marketplace', 'other'));

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
    case when p_source in ('link', 'instagram', 'snapchat', 'qr', 'marketplace') then p_source else 'other' end,
    1
  )
  on conflict (salon_id, day, source) do update set views = public.salon_page_views.views + 1;
$$;

-- Règle de 0052 : une fonction recréée est rouverte à PUBLIC — on la referme.
revoke execute on function public.record_page_view(uuid, text) from public, anon, authenticated;

alter table public.bookings drop constraint if exists bookings_origin_check;
alter table public.bookings
  add constraint bookings_origin_check check (origin in ('link', 'instagram', 'snapchat', 'qr', 'marketplace'));
