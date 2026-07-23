
-- Wave 2: Pricing SSOT ------------------------------------------------------
-- Extend plans with display metadata; add site_content table for cross-plan
-- pricing page content (trial days, compare matrix, FAQ, trust badges).

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS price_display text,
  ADD COLUMN IF NOT EXISTS price_suffix text,
  ADD COLUMN IF NOT EXISTS price_lead text,
  ADD COLUMN IF NOT EXISTS features_lead text,
  ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_marketed_enterprise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_kind text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS cta_label text NOT NULL DEFAULT 'Start Free 14-Day Trial',
  ADD COLUMN IF NOT EXISTS success_fee_label text,
  ADD COLUMN IF NOT EXISTS monthly_base_cents integer,
  ADD COLUMN IF NOT EXISTS ls_variant_env_key text;

-- Public read-only site content (pricing FAQ, compare matrix, trust badges).
CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_public_read" ON public.site_content;
CREATE POLICY "site_content_public_read" ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "site_content_super_admin_write" ON public.site_content;
CREATE POLICY "site_content_super_admin_write" ON public.site_content
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS site_content_set_updated_at ON public.site_content;
CREATE TRIGGER site_content_set_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Deactivate stray "scale" plan (business tier is the canonical row).
UPDATE public.plans SET is_active = false WHERE code = 'scale';

-- Seed canonical plan display fields (source-of-truth values from marketing).
UPDATE public.plans SET
  name = 'Starter',
  tagline = 'Best for startups.',
  description = 'Best for startups.',
  price_cents = 2900,
  monthly_base_cents = 2900,
  price_display = '$29',
  price_suffix = '/month',
  price_lead = NULL,
  success_fee_bps = 500,
  success_fee_label = '+5% of successfully recovered revenue',
  features_lead = NULL,
  features = '["AI Recovery Engine","Email Recovery","WhatsApp Recovery","1 Store Connection","Basic Dashboard","Basic Analytics","Community Support"]'::jsonb,
  highlight = false,
  is_marketed_enterprise = false,
  is_contact_sales = false,
  cta_kind = 'trial',
  cta_label = 'Start Free 14-Day Trial',
  trial_days = 14,
  sort_order = 10,
  ls_variant_env_key = 'LEMONSQUEEZY_VARIANT_STARTER',
  is_active = true
WHERE code = 'starter';

UPDATE public.plans SET
  name = 'Growth',
  tagline = 'For scaling teams that need automation and priority support.',
  description = 'For scaling teams that need automation and priority support.',
  price_cents = 9900,
  monthly_base_cents = 9900,
  price_display = '$99',
  price_suffix = '/month',
  price_lead = NULL,
  success_fee_bps = 400,
  success_fee_label = '+4% of successfully recovered revenue',
  features_lead = 'Everything in Starter, plus',
  features = '["Professional Dashboard","Advanced Analytics","Customer Segmentation","AI Recommendations","Workflow Automation","Up to 3 Store Connections","Priority Support"]'::jsonb,
  highlight = true,
  is_marketed_enterprise = false,
  is_contact_sales = false,
  cta_kind = 'trial',
  cta_label = 'Start Free 14-Day Trial',
  trial_days = 14,
  sort_order = 20,
  ls_variant_env_key = 'LEMONSQUEEZY_VARIANT_GROWTH',
  is_active = true
WHERE code = 'growth';

UPDATE public.plans SET
  name = 'Scale',
  tagline = 'Built for growing SaaS companies.',
  description = 'Built for growing SaaS companies.',
  price_cents = 29900,
  monthly_base_cents = 29900,
  price_display = '$299',
  price_suffix = '/month',
  price_lead = NULL,
  success_fee_bps = 300,
  success_fee_label = '+3% of successfully recovered revenue',
  features_lead = 'Everything in Growth, plus',
  features = '["Multiple Store Connections","Advanced Dashboard","Revenue Intelligence","Predictive Analytics","Enterprise-grade Security","Dedicated Success Manager"]'::jsonb,
  highlight = false,
  is_marketed_enterprise = false,
  is_contact_sales = false,
  cta_kind = 'trial',
  cta_label = 'Start Free 14-Day Trial',
  trial_days = 14,
  sort_order = 30,
  ls_variant_env_key = 'LEMONSQUEEZY_VARIANT_BUSINESS',
  is_active = true
WHERE code = 'business';

UPDATE public.plans SET
  name = 'Enterprise',
  tagline = 'For enterprises with advanced requirements.',
  description = 'For enterprises with advanced requirements.',
  price_cents = 99900,
  monthly_base_cents = NULL,
  starting_at_price_cents = 99900,
  price_display = 'Custom',
  price_suffix = NULL,
  price_lead = 'Starting at $999/month',
  success_fee_bps = 200,
  success_fee_label = '+1–2% of successfully recovered revenue',
  features_lead = NULL,
  features = '["White Label","Dedicated Infrastructure","Dedicated AI Environment","Enterprise SLA","Enterprise Services","Dedicated Engineer","Custom Integrations","Unlimited Stores","Custom AI Models"]'::jsonb,
  highlight = false,
  is_marketed_enterprise = true,
  is_contact_sales = true,
  cta_kind = 'contact_sales',
  cta_label = 'Talk to Sales',
  trial_days = 14,
  sort_order = 40,
  ls_variant_env_key = NULL,
  is_active = true
WHERE code = 'enterprise';

-- Seed cross-plan site content.
INSERT INTO public.site_content (key, value) VALUES
  ('pricing.trial_days', '14'::jsonb),
  ('pricing.trust_badges', '["14-Day Free Trial","No Credit Card Required","Cancel Anytime","AI Powered","Enterprise Ready"]'::jsonb),
  ('pricing.compare_rows', $json$[
    {"label":"AI Recovery Engine","values":[true,true,true,true]},
    {"label":"Email Recovery","values":[true,true,true,true]},
    {"label":"WhatsApp Recovery","values":[true,true,true,true]},
    {"label":"Dashboard","values":["Basic","Professional","Advanced","Custom"]},
    {"label":"Analytics","values":["Basic","Advanced","Predictive","Custom"]},
    {"label":"Revenue Intelligence","values":[false,false,true,true]},
    {"label":"Predictive Analytics","values":[false,false,true,true]},
    {"label":"Workflow Automation","values":[false,true,true,true]},
    {"label":"API","values":[true,true,true,true]},
    {"label":"Webhooks","values":[true,true,true,true]},
    {"label":"White Label","values":[false,false,false,true]},
    {"label":"Support","values":["Community","Priority","Dedicated CSM","Dedicated Engineer"]},
    {"label":"Communication Channels","values":["Email + WhatsApp","Email + WhatsApp","Email + WhatsApp","Email + WhatsApp + Custom"]},
    {"label":"Store Connections","values":["1","Up to 3","Multiple","Unlimited"]}
  ]$json$::jsonb),
  ('pricing.faq', $json$[
    {"q":"What is the success fee?","a":"In addition to your monthly plan, RRLabs charges a small percentage of the revenue we successfully recover for you. If we don't recover anything, you don't pay a success fee."},
    {"q":"Do I need a credit card to start?","a":"No. Every plan starts with a 14-day free trial — no credit card required. Add a payment method whenever you're ready to continue."},
    {"q":"Can I upgrade or downgrade later?","a":"Yes. You can change plans any time from your dashboard. Upgrades take effect immediately; downgrades take effect at the next renewal."},
    {"q":"How does billing work?","a":"A fixed monthly (or annual) subscription plus a success fee on recovered revenue. Payments are processed securely via Lemon Squeezy. You'll get a receipt and can cancel any time."},
    {"q":"Is my data secure?","a":"Yes. All data is encrypted in transit and at rest. We follow strict row-level access controls, keep detailed audit logs, and never share your data with third parties."},
    {"q":"Can I cancel any time?","a":"Absolutely. Cancel any time from your dashboard — no forms, no phone calls. You retain access through the end of your billing period."}
  ]$json$::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
