
CREATE TYPE public.email_pref_category AS ENUM ('billing','analytics','recovery','product','marketing');

CREATE TABLE public.email_subscription_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  category public.email_pref_category NOT NULL,
  subscribed boolean NOT NULL DEFAULT true,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, category)
);

CREATE INDEX email_subscription_preferences_email_idx
  ON public.email_subscription_preferences (lower(email));

GRANT SELECT, INSERT, UPDATE ON public.email_subscription_preferences TO authenticated;
GRANT ALL ON public.email_subscription_preferences TO service_role;

ALTER TABLE public.email_subscription_preferences ENABLE ROW LEVEL SECURITY;

-- Signed-in users can view/update only preferences that match their own email.
CREATE POLICY "users read own email prefs"
  ON public.email_subscription_preferences
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "users upsert own email prefs"
  ON public.email_subscription_preferences
  FOR INSERT TO authenticated
  WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "users update own email prefs"
  ON public.email_subscription_preferences
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE TRIGGER email_subscription_preferences_set_updated_at
  BEFORE UPDATE ON public.email_subscription_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
