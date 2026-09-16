-- Spécialités choisies à l'inscription (16 sept. 2026) : « Barbe » côté hommes, « Sourcils » côté femmes ;
-- maquillage et épilation redeviennent proposables (elles n'étaient plus que des clés historiques).
insert into public.categories (id, label_fr, label_ar, icon, sort_order, market) values
  ('barbe',    'Barbe',    'لحية',  'brush', 11, 'men'),
  ('sourcils', 'Sourcils', 'حواجب', 'eye',   24, 'women')
on conflict (id) do nothing;

update public.categories set sort_order = 26 where id = 'maquillage';
update public.categories set sort_order = 27 where id = 'epilation';
