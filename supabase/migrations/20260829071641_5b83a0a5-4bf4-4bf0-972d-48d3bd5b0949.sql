CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('aurona-cart-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'aurona-cart-reminders'
);

SELECT cron.schedule(
  'aurona-cart-reminders',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--df856491-2a01-479d-a091-00ef9fa974ed.lovable.app/api/public/cart-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', 'S44cFRvsxvvUpvMj4xFYgdFNF7uITybZC-4ESe-hSsUqtd5W'
    ),
    body := '{}'::jsonb
  );
  $$
);