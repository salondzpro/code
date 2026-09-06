-- 0004 — Modèle imposé par le design « App Beaute Hi-Fi » :
--   • marché choisi par le client (Pour Hommes / Pour Femmes) et rappels WhatsApp,
--   • catégories rattachées à un marché (catalogues strictement séparés),
--   • logo et zone d'activité du salon,
--   • photos par prestation (« prestations illustrées », « réalisations »).
-- Les anciennes catégories restent en base (salons existants) mais sont rattachées à un marché.

alter table public.profiles
  add column if not exists market text check (market in ('men', 'women')),
  add column if not exists whatsapp_reminders boolean not null default true;

alter table public.categories
  add column if not exists market text check (market in ('men', 'women'));

insert into public.categories (id, label_fr, label_ar, icon, sort_order, market) values
  ('coiffure',          'Coiffure',                      'حلاقة',                    'scissors', 10, 'men'),
  ('lissage',           'Lissage',                       'تمليس',                    'wand',     11, 'men'),
  ('coloration-meches', 'Coloration & mèches',           'صبغة وخصل',                'palette',  12, 'men'),
  ('soins-peau',        'Soins & nettoyage de la peau',  'العناية بالبشرة وتنظيفها', 'sparkles', 13, 'men'),
  ('tresses',           'Tresses / braids',              'ضفائر',                    'brush',    14, 'men'),
  ('manucure',          'Manucure, mains & pieds',       'مانيكير، يدين وقدمين',     'hand',     20, 'women'),
  ('ongles',            'Ongles',                        'أظافر',                    'hand',     21, 'women'),
  ('coiffure-lissage',  'Coiffure & lissage',            'تصفيف وتمليس',             'scissors', 22, 'women'),
  ('cils',              'Cils',                          'رموش',                     'eye',      23, 'women'),
  ('soins',             'Soins',                         'عناية',                    'flower',   24, 'women'),
  ('laser',             'Laser',                         'ليزر',                     'zap',      25, 'women')
on conflict (id) do update
  set label_fr = excluded.label_fr, label_ar = excluded.label_ar, icon = excluded.icon, sort_order = excluded.sort_order, market = excluded.market;

update public.categories set market = 'men'   where id in ('coiffure-homme', 'barbier') and market is null;
update public.categories set market = 'women' where id in ('coiffure-femme', 'esthetique', 'onglerie', 'maquillage', 'epilation', 'spa-hammam') and market is null;

alter table public.salons
  add column if not exists logo_url text,
  add column if not exists zone text;

create table if not exists public.service_photos (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  url text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists service_photos_service_idx on public.service_photos (service_id, sort_order);
alter table public.service_photos enable row level security;
create policy "service_photos: lecture publique" on public.service_photos for select using (true);
create policy "service_photos: propriétaire" on public.service_photos for all
  using (exists (select 1 from public.services sv join public.salons s on s.id = sv.salon_id where sv.id = service_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.services sv join public.salons s on s.id = sv.salon_id where sv.id = service_id and s.owner_id = auth.uid()));
