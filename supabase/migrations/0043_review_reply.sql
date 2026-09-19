-- 0043 — Réponse du professionnel à un avis (point 19 du plan de mise en production).
--
-- Un avis engage la réputation d'un salon et il ne pouvait rien en dire : l'espace pro n'avait
-- aucun écran des avis, et le seul moyen de les lire était d'ouvrir sa propre page publique.
-- Une réponse posée et publique vaut mieux qu'un avis laissé seul — c'est aussi ce que lisent
-- les futurs clients.
--
-- La réponse est PUBLIQUE et unique : un seul texte par avis, modifiable, effaçable. Elle
-- n'altère jamais l'avis lui-même ni la note ; le professionnel répond, il ne corrige pas.

alter table public.reviews
  add column if not exists reply text check (reply is null or char_length(reply) <= 600),
  add column if not exists replied_at timestamptz;

comment on column public.reviews.reply is 'Réponse publique du salon ; nulle tant qu''il n''a pas répondu.';

-- Les avis répondus d'un salon, pour l'écran pro : un index partiel suffit, on ne trie jamais
-- sur la réponse elle-même.
create index if not exists reviews_salon_unanswered_idx
  on public.reviews (salon_id, created_at desc) where reply is null;

-- Lecture directe avec la clé publique : la migration 0039 a redonné le SELECT colonne par
-- colonne, donc les colonnes ajoutées ensuite n'y sont pas. On rejoue la même règle pour
-- `reviews` afin que la réponse, qui est publique, le soit aussi par ce chemin.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'reviews' and column_name <> 'client_id';
  execute format('revoke select on public.reviews from anon, authenticated');
  execute format('grant select (%s) on public.reviews to anon, authenticated', cols);
end $$;
