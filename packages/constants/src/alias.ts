/**
 * DEUX COMPTES POUR UNE MÊME ADRESSE (16 nov. 2026, séparation stricte client / pro).
 *
 * L'authentification n'accepte qu'un compte par adresse e-mail. Quand une adresse sert déjà à un compte
 * de l'AUTRE côté (un pro qui veut aussi réserver comme client, ou l'inverse), le second compte est
 * enregistré sous une adresse INTERNE, déterministe, jamais montrée : `<rôle>-<24 hex de SHA-256 de
 * l'adresse>@alias.salondz.com`. La vraie adresse reste dans `user_metadata.contact_email`, et tous les
 * e-mails (lien de connexion, confirmation, mot de passe oublié) partent vers elle — c'est l'API qui
 * les envoie, jamais Supabase. Le calcul existe deux fois, à l'identique : `apps/api/src/routes/auth.ts`
 * (Node) et `apps/web/src/lib/alias.ts` (navigateur).
 */
export const ALIAS_DOMAIN = 'alias.salondz.com';

/** Adresse interne ? (à ne jamais afficher : montrer `contact_email` à la place). */
export const isAliasEmail = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(`@${ALIAS_DOMAIN}`);
