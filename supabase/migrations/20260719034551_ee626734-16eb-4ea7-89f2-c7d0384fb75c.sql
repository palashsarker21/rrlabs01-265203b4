
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  page text CHECK (page IS NULL OR char_length(page) <= 512),
  component text CHECK (component IS NULL OR char_length(component) <= 64),
  platform text CHECK (platform IS NULL OR char_length(platform) <= 64),
  meta jsonb,
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON public.analytics_events (name, created_at DESC);

GRANT INSERT ON public.analytics_events TO anon;
GRANT INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can insert analytics events" ON public.analytics_events;
CREATE POLICY "anon can insert analytics events"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "super admins can read analytics events" ON public.analytics_events;
CREATE POLICY "super admins can read analytics events"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
