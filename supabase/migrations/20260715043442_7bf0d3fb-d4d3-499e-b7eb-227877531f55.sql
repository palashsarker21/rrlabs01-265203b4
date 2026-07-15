
ALTER TABLE public.plans ALTER COLUMN ls_variant_id DROP NOT NULL;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS success_fee_bps integer,
  ADD COLUMN IF NOT EXISTS is_contact_sales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starting_at_price_cents integer;

UPDATE public.plans SET is_active = false WHERE code = 'scale';

INSERT INTO public.plans (code, name, description, price_cents, currency, interval, trial_days, features, sort_order, is_active, ls_variant_id, success_fee_bps, is_contact_sales, starting_at_price_cents)
VALUES
  ('starter', 'Starter', 'Best for startups getting started with revenue recovery.', 2900, 'USD', 'month', 14,
    '["AI Recovery Engine","Email Recovery","WhatsApp Recovery","1 Store Connection","Basic Dashboard","Basic Analytics","Community Support"]'::jsonb,
    10, true, null, 300, false, null),
  ('growth', 'Growth', 'For scaling teams that need automation and priority support.', 9900, 'USD', 'month', 14,
    '["Everything in Starter","Professional Dashboard","Advanced Analytics","Customer Segmentation","AI Recommendations","Workflow Automation","Up to 3 Store Connections","Priority Support"]'::jsonb,
    20, true, null, 250, false, null),
  ('business', 'Business', 'Built for growing SaaS companies operating at scale.', 29900, 'USD', 'month', 14,
    '["Everything in Growth","Multiple Store Connections","Advanced Dashboard","Revenue Intelligence","Predictive Analytics","Enterprise-grade Security","Dedicated Success Manager"]'::jsonb,
    30, true, null, 200, false, null),
  ('enterprise', 'Enterprise', 'White-label, dedicated infrastructure, and a dedicated engineer.', 99900, 'USD', 'month', 14,
    '["White Label","Dedicated Infrastructure","Dedicated AI Environment","Enterprise SLA","Enterprise Services","Dedicated Engineer","Custom Integrations","Unlimited Stores","Custom AI Models"]'::jsonb,
    40, true, null, 200, true, 99900)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  interval = EXCLUDED.interval,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  success_fee_bps = EXCLUDED.success_fee_bps,
  is_contact_sales = EXCLUDED.is_contact_sales,
  starting_at_price_cents = EXCLUDED.starting_at_price_cents,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.contact_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  role text,
  seats text,
  arr_range text,
  use_case text,
  plan_code text,
  source text,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_leads TO anon;
GRANT INSERT ON public.contact_leads TO authenticated;
GRANT ALL ON public.contact_leads TO service_role;

ALTER TABLE public.contact_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_leads_insert_public"
  ON public.contact_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(name, '')) BETWEEN 1 AND 120
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) BETWEEN 3 AND 254
    AND length(coalesce(use_case, '')) <= 4000
  );

CREATE POLICY "contact_leads_read_super_admin"
  ON public.contact_leads FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
