
CREATE TABLE public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_settings_super_admin_read ON public.admin_settings
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY admin_settings_super_admin_write ON public.admin_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER admin_settings_set_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed baseline production settings
INSERT INTO public.admin_settings (key, value, description) VALUES
  ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb, 'Global maintenance mode toggle'),
  ('signups_enabled',  '{"enabled": true}'::jsonb, 'Whether new signups are accepted'),
  ('support_email',    '{"value": "support@rrlabs.online"}'::jsonb, 'Public support email'),
  ('rate_limits',      '{"webhooks_per_min": 120, "api_per_min": 600}'::jsonb, 'Global rate limits')
ON CONFLICT (key) DO NOTHING;
