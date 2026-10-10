-- Ce que la CLÉ PUBLIQUE peut faire, et qu'elle ne doit pas (audit du 10 oct. 2026).
--
-- 1) `admin_profiles_page` et `admin_salons_page` : la migration 0045 les a SUPPRIMÉES puis recréées,
--    et les `revoke` de 0044 sont morts avec elles. Une fonction neuve est exécutable par PUBLIC :
--    n'importe qui, avec la clé publiable (celle du bundle du site), pouvait lister tous les comptes
--    (nom, numéro, e-mail, absences, motif de suspension) et tous les salons avec leur chiffre
--    d'affaires. Vérifié en production le 10 oct. : `has_function_privilege('anon', …) = true`.
--    `book_slot` (0001) restait aussi appelable par un compte : il contourne les garde-fous de l'API
--    (plafond de rendez-vous, suspension anti-abus, notification du salon).
--    On révoque par NOM, toutes signatures confondues : une recréation future ne doit pas rouvrir.
--
-- 2) Les comptes connectés avaient UPDATE / INSERT / DELETE sur `profiles`, `salons`, `reviews` et
--    `bookings` — les politiques RLS limitent les LIGNES (les siennes), pas les COLONNES : un client
--    suspendu pouvait effacer sa propre suspension, changer son numéro verrouillé, démasquer un avis
--    modéré ; un propriétaire pouvait lever le gel de son salon ou s'écrire une note de 5/5.
--    Le site et l'application n'écrivent JAMAIS directement dans ces tables (tout passe par l'API,
--    clé secrète) : on retire les droits d'écriture, et on garde SELECT (temps réel, lecture RLS).
--
-- Supabase accorde par défaut tous les droits sur une table neuve à anon/authenticated : toute
-- nouvelle table sensible doit recevoir le même traitement.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_profiles_page', 'admin_salons_page', 'admin_bookings_page', 'admin_overview', 'book_slot')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

revoke insert, update, delete, truncate, references, trigger
  on public.profiles, public.salons, public.reviews, public.bookings
  from anon, authenticated;
