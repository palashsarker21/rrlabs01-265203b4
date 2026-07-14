
CREATE TYPE public.subscription_status AS ENUM (
  'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired'
);

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  ls_product_id text,
  ls_variant_id text NOT NULL UNIQUE,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  interval text NOT NULL DEFAULT 'month',
  trial_days integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ls_subscription_id text UNIQUE,
  ls_customer_id text,
  ls_order_id text,
  ls_variant_id text,
  status public.subscription_status NOT NULL DEFAULT 'on_trial',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  renews_at timestamptz,
  ends_at timestamptz,
  cancelled_at timestamptz,
  update_payment_url text,
  customer_portal_url text,
  card_brand text,
  card_last_four text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX subscriptions_workspace_idx ON public.subscriptions(workspace_id);
CREATE INDEX subscriptions_status_idx ON public.subscriptions(status);
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "subscriptions_read_members" ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  workspace_name text NOT NULL,
  organization_name text NOT NULL,
  ls_checkout_id text,
  ls_checkout_url text,
  status text NOT NULL DEFAULT 'pending',
  fulfilled_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.checkout_sessions TO authenticated;
GRANT ALL ON public.checkout_sessions TO service_role;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX checkout_sessions_user_idx ON public.checkout_sessions(user_id);
CREATE TRIGGER checkout_sessions_updated_at BEFORE UPDATE ON public.checkout_sessions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "checkout_sessions_read_own" ON public.checkout_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'lemonsqueezy',
  event_name text NOT NULL,
  event_id text,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX billing_events_workspace_idx ON public.billing_events(workspace_id);

INSERT INTO public.plans (code, name, description, ls_variant_id, price_cents, currency, interval, trial_days, features, sort_order)
VALUES
  ('starter', 'Starter', 'Recover up to 500 failed payments / month', 'ls_variant_starter_placeholder', 4900, 'USD', 'month', 14, '["500 recovery attempts","Email + WhatsApp","Basic analytics"]'::jsonb, 1),
  ('growth',  'Growth',  'Recover up to 5,000 failed payments / month', 'ls_variant_growth_placeholder', 14900, 'USD', 'month', 14, '["5,000 recovery attempts","AI copywriter","Priority support"]'::jsonb, 2),
  ('scale',   'Scale',   'Unlimited recovery volume for high-growth SaaS', 'ls_variant_scale_placeholder', 39900, 'USD', 'month', 14, '["Unlimited attempts","Dedicated CSM","Custom integrations"]'::jsonb, 3)
ON CONFLICT (ls_variant_id) DO NOTHING;
