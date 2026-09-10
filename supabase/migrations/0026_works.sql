-- 0026 — Photos du salon en deux familles distinctes :
--   * kind = 'cover' : photos de couverture (carrousel des cartes, en-tête de la page publique) ;
--   * kind = 'work'  : réalisations (coupes, coiffures, barbes, colorations…), plusieurs photos, section « Réalisations ».
-- Une prestation ne garde qu'UNE image représentative : les photos d'exemples (sort_order > 0) rejoignent les
-- réalisations du salon pour ne rien perdre.
alter table public.salon_photos
  add column if not exists kind text not null default 'cover' check (kind in ('cover', 'work'));
create index if not exists salon_photos_kind_idx on public.salon_photos (salon_id, kind, sort_order);

insert into public.salon_photos (salon_id, url, sort_order, kind)
select s.salon_id, sp.url, 1000 + sp.sort_order, 'work'
from public.service_photos sp
join public.services s on s.id = sp.service_id
where sp.sort_order > 0;

delete from public.service_photos where sort_order > 0;
