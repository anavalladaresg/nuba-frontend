-- Sustituye estos valores antes de ejecutar:
--   <PROJECT_REF>
--   <SUPABASE_PUBLISHABLE_KEY>
--   <NUBA_CRON_SECRET>
--
-- Despliega antes la Edge Function con:
--   supabase functions deploy workday-reminders --no-verify-jwt

select
  cron.schedule(
    'nuba-workday-reminders-every-5-minutes',
    '*/5 * * * *',
    $$
    select
      net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/workday-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', '<SUPABASE_PUBLISHABLE_KEY>',
          'x-nuba-cron-secret', '<NUBA_CRON_SECRET>'
        ),
        body := jsonb_build_object('trigger', 'pg_cron')
      );
    $$
  );

-- Para eliminar el cron más adelante:
-- select cron.unschedule('nuba-workday-reminders-every-5-minutes');
