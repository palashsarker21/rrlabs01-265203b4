
INSERT INTO public.admin_settings (key, value, description) VALUES
  ('god_mode', '{"enabled": false}'::jsonb, 'Master God Mode switch. Requires super admin.'),
  ('read_only_mode', '{"enabled": false}'::jsonb, 'When on, all write endpoints are rejected.'),
  ('lockdown_mode', '{"enabled": false}'::jsonb, 'Emergency lockdown: blocks all non-admin traffic.'),
  ('logins_enabled', '{"enabled": true}'::jsonb, 'Whether existing users can sign in.'),
  ('billing_enabled', '{"enabled": true}'::jsonb, 'Billing and checkout endpoints kill switch.'),
  ('checkout_enabled', '{"enabled": true}'::jsonb, 'Checkout kill switch (independent of billing).'),
  ('recovery_engine_enabled', '{"enabled": true}'::jsonb, 'Global recovery engine kill switch.'),
  ('ai_enabled', '{"enabled": true}'::jsonb, 'AI features kill switch.'),
  ('webhooks_enabled', '{"enabled": true}'::jsonb, 'Inbound webhooks kill switch.'),
  ('api_enabled', '{"enabled": true}'::jsonb, 'Public API kill switch.'),
  ('email_enabled', '{"enabled": true}'::jsonb, 'Outbound email kill switch.'),
  ('whatsapp_enabled', '{"enabled": true}'::jsonb, 'Outbound WhatsApp kill switch.'),
  ('sms_enabled', '{"enabled": true}'::jsonb, 'Outbound SMS kill switch.'),
  ('background_jobs_enabled', '{"enabled": true}'::jsonb, 'Background jobs kill switch.'),
  ('cron_enabled', '{"enabled": true}'::jsonb, 'Cron scheduler kill switch.')
ON CONFLICT (key) DO NOTHING;
