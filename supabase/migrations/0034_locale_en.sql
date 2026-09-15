-- Langue du profil : anglais accepté en plus du français et de l'arabe (interface traduite).
alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check check (locale in ('fr', 'ar', 'en'));
