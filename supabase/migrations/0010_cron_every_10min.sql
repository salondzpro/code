-- =====================================================================
-- Hébergement Render (plan gratuit) : l'API est mise en veille après 15 min sans requête.
-- Le tick passe de 15 à 10 min : il garde l'instance éveillée en plus de ses tâches
-- (rappels J-1, clôture auto, expiration des demandes, push). No-op tant que
-- app_settings (api_url, cron_token) n'est pas renseigné.
--
-- Après le déploiement sur Render :
--   insert into public.app_settings (key, value) values
--     ('api_url', 'https://salondz-api.onrender.com'),
--     ('cron_token', '<INTERNAL_CRON_TOKEN>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
-- =====================================================================
select cron.unschedule('salondz-api-tick');
select cron.schedule('salondz-api-tick', '*/10 * * * *', $$ select public.cron_call_api_tick() $$);
