-- =====================================================================
-- Tâches périodiques : pg_cron appelle l'API (/internal/cron/tick) via pg_net.
-- Rappels J-1, clôture auto des RDV, envoi des push en attente.
--
-- Après le déploiement de l'API, renseigner :
--   insert into public.app_settings (key, value) values
--     ('api_url', 'https://salondz-api.fly.dev'),
--     ('cron_token', '<INTERNAL_CRON_TOKEN>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
-- Tant que ces clés sont absentes, le job ne fait rien (no-op silencieux).
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.cron_call_api_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_token text;
begin
  select value into v_url from public.app_settings where key = 'api_url';
  select value into v_token from public.app_settings where key = 'cron_token';
  if v_url is null or v_token is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/internal/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;

revoke execute on function public.cron_call_api_tick() from public, anon, authenticated;

-- Toutes les 15 minutes
select cron.schedule('salondz-api-tick', '*/15 * * * *', $$ select public.cron_call_api_tick() $$);
