-- Update check-reminders cron to run hourly for timezone-aware delivery
-- Delete old daily job and create new hourly job

SELECT cron.unschedule('daily-check-reminders');

SELECT cron.schedule(
  'hourly-check-reminders',
  '0 * * * *',
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
