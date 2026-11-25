-- TYPE DU COMPTE DANS LE JETON DE CONNEXION (25 nov. 2026, demande du propriétaire).
--
-- « Custom Access Token Hook » de Supabase : à chaque jeton émis (connexion, Google, Apple, lien,
-- renouvellement), Supabase appelle cette fonction, qui ajoute la revendication `portail`
-- (`client` | `pro`) lue sur le profil. Toute session porte ainsi son type, signé par Supabase,
-- infalsifiable. Activation : tableau de bord Supabase → Authentication → Hooks → Custom Access
-- Token → public.custom_access_token_hook.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  r text;
  claims jsonb := event->'claims';
begin
  select p.role::text into r from public.profiles p where p.id = (event->>'user_id')::uuid;
  claims := jsonb_set(claims, '{portail}', to_jsonb(case when r = 'pro' then 'pro' else 'client' end));
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Seul le serveur d'authentification de Supabase l'appelle.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

-- Il lit le rôle du profil (RLS active sur `profiles`).
grant select on public.profiles to supabase_auth_admin;
drop policy if exists "auth lit le role" on public.profiles;
create policy "auth lit le role" on public.profiles as permissive for select to supabase_auth_admin using (true);
