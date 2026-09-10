-- 0025 — Coordonnées d'un membre de l'équipe : numéro de téléphone (E.164, facultatif), modifiable par le pro
-- depuis la fiche du membre avec son nom affiché. Jamais exposé côté public.
alter table public.staff
  add column if not exists phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');
