-- Visites de la page publique d'un salon (1er nov. 2026, carte « Votre page » de l'accueil pro,
-- maquette 11 du canevas) : combien de personnes ont ouvert la page cette semaine, jour par jour,
-- et d'où elles venaient (lien partagé, Instagram, code QR imprimé).
--
-- On ne garde AUCUNE donnée personnelle : ni adresse, ni compte, ni appareil — un compteur par
-- salon, par jour (heure d'Alger) et par provenance. Une même personne qui recharge la page n'est
-- comptée qu'une fois par session (le site ne renvoie pas la visite), et l'API limite le débit.
--
-- Écriture par la fonction `record_page_view`, appelée par l'API seule (clé secrète). Table et
-- fonction fermées à la clé publique (règle de 0052 : une table neuve est ouverte par défaut).

create table if not exists public.salon_page_views (
  salon_id uuid not null references public.salons(id) on delete cascade,
  day date not null,
  source text not null check (source in ('link', 'instagram', 'qr', 'other')),
  views integer not null default 0 check (views >= 0),
  primary key (salon_id, day, source)
);

alter table public.salon_page_views enable row level security;
revoke all on public.salon_page_views from public, anon, authenticated;

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
    case when p_source in ('link', 'instagram', 'qr') then p_source else 'other' end,
    1
  )
  on conflict (salon_id, day, source) do update set views = public.salon_page_views.views + 1;
$$;

revoke execute on function public.record_page_view(uuid, text) from public, anon, authenticated;
