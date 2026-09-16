-- Colonnes sensibles hors de portée de la clé publique (16 sept. 2026, audit sécurité I4).
-- Les policies RLS filtrent des LIGNES ; avec la clé publiable, `select=phone` sur `staff` ou `salons`
-- renvoyait donc les numéros, et `reviews.client_id` reliait un avis à un compte. Le front ne lit ces
-- tables que par l'API (clé secrète, non concernée) : on retire le SELECT de table à anon/authenticated
-- et on le redonne colonne par colonne, sauf celles qui n'ont rien à faire dehors. Dynamique : une
-- colonne ajoutée plus tard est exposée par défaut ; l'ajouter à la liste d'exclusion si elle est sensible.
do $$
declare
  t record;
  cols text;
begin
  for t in
    select * from (values
      ('salons',  array['phone', 'owner_id']),
      ('staff',   array['phone', 'user_id']),
      ('reviews', array['client_id'])
    ) as v(tbl, hidden)
  loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema = 'public' and table_name = t.tbl and not (column_name = any (t.hidden));
    execute format('revoke select on public.%I from anon, authenticated', t.tbl);
    execute format('grant select (%s) on public.%I to anon, authenticated', cols, t.tbl);
  end loop;
end $$;
