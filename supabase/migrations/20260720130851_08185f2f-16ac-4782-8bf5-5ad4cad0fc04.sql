
CREATE TYPE public.marketplace_status AS ENUM ('draft','published','archived');

CREATE TABLE public.marketplace_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status public.marketplace_status NOT NULL DEFAULT 'draft',
  industry text,
  region text,
  country text,
  language text NOT NULL DEFAULT 'en',
  channel public.recovery_channel NOT NULL,
  failure_classification public.failure_classification,
  tone text,
  product_kind text,
  customer_segment text,
  step integer NOT NULL DEFAULT 1,
  subject text,
  body_text text,
  body_html text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  usage_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_templates TO authenticated, anon;
GRANT ALL ON public.marketplace_templates TO service_role;
ALTER TABLE public.marketplace_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX mkt_tpl_filters_idx ON public.marketplace_templates (status, industry, region, language, channel);
CREATE INDEX mkt_tpl_tags_idx ON public.marketplace_templates USING gin (tags);
CREATE POLICY "mkt_tpl read published" ON public.marketplace_templates
  FOR SELECT USING (status = 'published' OR public.is_super_admin(auth.uid()));
CREATE POLICY "mkt_tpl super admin write" ON public.marketplace_templates
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER mkt_tpl_set_updated_at BEFORE UPDATE ON public.marketplace_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.marketplace_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status public.marketplace_status NOT NULL DEFAULT 'draft',
  industry text,
  region text,
  country text,
  language text NOT NULL DEFAULT 'en',
  failure_classification public.failure_classification,
  tone text,
  product_kind text,
  customer_segment text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  usage_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_flows TO authenticated, anon;
GRANT ALL ON public.marketplace_flows TO service_role;
ALTER TABLE public.marketplace_flows ENABLE ROW LEVEL SECURITY;
CREATE INDEX mkt_flow_filters_idx ON public.marketplace_flows (status, industry, region, language);
CREATE INDEX mkt_flow_tags_idx ON public.marketplace_flows USING gin (tags);
CREATE POLICY "mkt_flow read published" ON public.marketplace_flows
  FOR SELECT USING (status = 'published' OR public.is_super_admin(auth.uid()));
CREATE POLICY "mkt_flow super admin write" ON public.marketplace_flows
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER mkt_flow_set_updated_at BEFORE UPDATE ON public.marketplace_flows
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.template_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  marketplace_template_id uuid NOT NULL REFERENCES public.marketplace_templates(id) ON DELETE CASCADE,
  recovery_template_id uuid REFERENCES public.recovery_templates(id) ON DELETE SET NULL,
  installed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version_installed integer NOT NULL,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_installations TO authenticated;
GRANT ALL ON public.template_installations TO service_role;
ALTER TABLE public.template_installations ENABLE ROW LEVEL SECURITY;
CREATE INDEX tpl_install_ws_idx ON public.template_installations (workspace_id, installed_at DESC);
CREATE POLICY "tpl_install read" ON public.template_installations
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'templates.read'));
CREATE POLICY "tpl_install write" ON public.template_installations
  FOR ALL USING (public.has_permission(auth.uid(), workspace_id, 'templates.write'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'templates.write'));

CREATE TABLE public.flow_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  marketplace_flow_id uuid NOT NULL REFERENCES public.marketplace_flows(id) ON DELETE CASCADE,
  recovery_template_ids uuid[] NOT NULL DEFAULT '{}',
  installed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version_installed integer NOT NULL,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_installations TO authenticated;
GRANT ALL ON public.flow_installations TO service_role;
ALTER TABLE public.flow_installations ENABLE ROW LEVEL SECURITY;
CREATE INDEX flow_install_ws_idx ON public.flow_installations (workspace_id, installed_at DESC);
CREATE POLICY "flow_install read" ON public.flow_installations
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'templates.read'));
CREATE POLICY "flow_install write" ON public.flow_installations
  FOR ALL USING (public.has_permission(auth.uid(), workspace_id, 'templates.write'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'templates.write'));

-- Seeds
INSERT INTO public.marketplace_templates
  (slug, name, description, status, industry, region, language, channel, failure_classification, tone, step, subject, body_text, tags, published_at)
VALUES
  ('saas-us-en-email-soft-decline-1','SaaS · US · Soft decline · Email #1',
   'Friendly first reminder for SaaS subscription with a soft decline in the US market.','published',
   'saas','US','en','email','soft_decline','friendly',1,
   'Quick heads-up about your {{plan_name}} subscription',
   E'Hi {{first_name}},\n\nWe tried charging your card ending in {{card_last4}} for {{plan_name}} ({{amount}}) and it didn''t go through.\n\nThis is usually a temporary bank issue — you can retry the payment here: {{retry_url}}\n\nNo action means your access will pause on {{grace_end_date}}.\n\nThanks for being with us,\nThe {{brand_name}} team',
   ARRAY['subscription','saas','soft-decline'], now()),
  ('dtc-eu-en-whatsapp-insufficient-1','DTC · EU · Insufficient funds · WhatsApp #1',
   'Casual first WhatsApp nudge for EU ecommerce when card had insufficient funds.','published',
   'dtc','EU','en','whatsapp','insufficient_funds','casual',1,NULL,
   E'Hey {{first_name}} 👋 your order #{{order_number}} for {{amount}} didn''t go through — looks like it was a funds issue. Want to try again? {{retry_url}}',
   ARRAY['ecommerce','whatsapp','insufficient-funds'], now()),
  ('retail-latam-es-whatsapp-expired-1','Retail · LATAM · Tarjeta vencida · WhatsApp #1',
   'Aviso corto por WhatsApp para retail LATAM cuando la tarjeta está vencida.','published',
   'retail','LATAM','es','whatsapp','expired_card','neutral',1,NULL,
   E'Hola {{first_name}} 👋 tu pago de {{amount}} en {{brand_name}} falló porque tu tarjeta venció. Actualízala aquí: {{retry_url}}',
   ARRAY['retail','whatsapp','expired-card'], now()),
  ('fintech-uk-en-email-hard-decline-final','Fintech · UK · Hard decline · Final email',
   'Firm final email for UK fintech before service suspension.','published',
   'fintech','UK','en','email','hard_decline','formal',3,
   'Final notice: action required on your {{brand_name}} account',
   E'Dear {{first_name}},\n\nWe have been unable to process payment of {{amount}} on your {{brand_name}} account despite previous attempts. Your service will be suspended on {{suspension_date}} unless payment is completed.\n\nUpdate your payment method: {{retry_url}}\n\nRegards,\n{{brand_name}} Billing Team',
   ARRAY['fintech','email','hard-decline','final-notice'], now()),
  ('hospitality-mena-ar-whatsapp-soft-1','Hospitality · MENA · Soft decline · WhatsApp AR',
   'رسالة ودية باللغة العربية للفنادق والضيافة في منطقة الشرق الأوسط.','published',
   'hospitality','MENA','ar','whatsapp','soft_decline','friendly',1,NULL,
   E'مرحباً {{first_name}} 👋\nلم نتمكن من معالجة دفعتك بمبلغ {{amount}} لحجزك #{{booking_ref}}. غالبًا ما تكون مشكلة بنكية مؤقتة.\nيمكنك إعادة المحاولة من هنا: {{retry_url}}',
   ARRAY['hospitality','whatsapp','arabic'], now()),
  ('health-apac-en-email-soft-decline-1','Health · APAC · Soft decline · Email #1',
   'Polite first email for APAC health & wellness subscriptions on soft decline.','published',
   'health','APAC','en','email','soft_decline','professional',1,
   'Payment issue on your {{brand_name}} plan',
   E'Hi {{first_name}},\n\nWe were unable to charge your card for {{amount}} on your {{plan_name}} plan. This is usually a temporary issue.\n\nRetry your payment here: {{retry_url}}\n\nWith care,\nThe {{brand_name}} team',
   ARRAY['health','email','soft-decline'], now());

INSERT INTO public.marketplace_flows
  (slug, name, description, status, industry, region, language, failure_classification, tone, steps, tags, published_at)
VALUES
  ('saas-us-en-soft-decline-3step','SaaS · US · Soft decline · 3-step recovery',
   'Recommended 3-step flow for US SaaS soft declines: gentle email at 15m, WhatsApp nudge at 24h, formal email at 72h.',
   'published','saas','US','en','soft_decline','friendly',
   jsonb_build_array(
     jsonb_build_object('step',1,'channel','email','offset_minutes',15,'tone','friendly',
       'subject','Quick heads-up about your {{plan_name}} subscription',
       'body_text','Hi {{first_name}},\n\nYour card ending {{card_last4}} was declined for {{plan_name}} ({{amount}}). Most soft declines clear within a day — retry here: {{retry_url}}\n\nThanks,\nThe {{brand_name}} team'),
     jsonb_build_object('step',2,'channel','whatsapp','offset_minutes',1440,'tone','casual',
       'body_text','Hey {{first_name}} 👋 gentle nudge — your {{brand_name}} payment for {{amount}} still hasn''t gone through. One-tap retry: {{retry_url}}'),
     jsonb_build_object('step',3,'channel','email','offset_minutes',4320,'tone','formal',
       'subject','Action required: your {{brand_name}} subscription',
       'body_text','Hi {{first_name}},\n\nWe still cannot process {{amount}} for {{plan_name}}. Access will pause on {{grace_end_date}} unless payment completes.\n\nUpdate payment method: {{retry_url}}\n\n— {{brand_name}}')
   ),
   ARRAY['saas','sequence','soft-decline','recommended'], now()),
  ('dtc-eu-en-insufficient-2step','DTC · EU · Insufficient funds · 2-step',
   '2-step recovery for EU DTC: WhatsApp immediately, follow-up email at 24h.','published',
   'dtc','EU','en','insufficient_funds','casual',
   jsonb_build_array(
     jsonb_build_object('step',1,'channel','whatsapp','offset_minutes',30,'tone','casual',
       'body_text','Hey {{first_name}} 👋 quick heads-up — your order #{{order_number}} for {{amount}} didn''t clear. Retry when ready: {{retry_url}}'),
     jsonb_build_object('step',2,'channel','email','offset_minutes',1440,'tone','friendly',
       'subject','Still holding your order #{{order_number}}',
       'body_text','Hi {{first_name}},\n\nWe''re still holding order #{{order_number}} ({{amount}}). Complete payment here: {{retry_url}}\n\nThanks,\n{{brand_name}}')
   ),
   ARRAY['dtc','sequence','insufficient-funds'], now());
