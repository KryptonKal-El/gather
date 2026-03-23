-- Enable pg_cron extension for scheduled jobs (available on Supabase hosted)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net extension for HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily reminder check at 9:00 AM UTC
-- Calls the check-reminders Edge Function via HTTP POST
SELECT cron.schedule(
  'daily-check-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nvumgewnllqxzpaxubya.supabase.co/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
