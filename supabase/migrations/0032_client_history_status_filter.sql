-- Historique client filtrable par statut (fiche client paginée : Tout / Terminés / Annulés /
-- Absences). Le filtre vit ici, pas côté API : filtrer une page déjà découpée donnerait des
-- pages inégales et un compte faux. Nouvelle signature (p_status), l'ancienne est retirée.
drop function if exists public.salon_client_history(uuid, text, int, int);
create or replace function public.salon_client_history(
  p_salon_id uuid,
  p_client_key text,
  p_limit int default 50,
  p_offset int default 0,
  p_status public.booking_status default null
)
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
    and (p_status is null or bk.status = p_status)
  order by bk.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function public.salon_client_history(uuid, text, int, int, public.booking_status) from public, anon, authenticated;
