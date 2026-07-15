
CREATE TABLE public.provider_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('store','gateway','email','messaging')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  logo_url text,
  setup_instructions text NOT NULL DEFAULT '',
  setup_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  webhook_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  docs_url text,
  enabled boolean NOT NULL DEFAULT true,
  beta boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_catalog TO authenticated, anon;
GRANT ALL ON public.provider_catalog TO service_role;
ALTER TABLE public.provider_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_catalog_read_all" ON public.provider_catalog FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "provider_catalog_admin_write" ON public.provider_catalog FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER tg_provider_catalog_updated BEFORE UPDATE ON public.provider_catalog
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.provider_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  provider_kind text NOT NULL CHECK (provider_kind IN ('store','gateway','email','messaging')),
  max_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_code, provider_kind)
);
GRANT SELECT ON public.provider_limits TO authenticated, anon;
GRANT ALL ON public.provider_limits TO service_role;
ALTER TABLE public.provider_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_limits_read_all" ON public.provider_limits FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "provider_limits_admin_write" ON public.provider_limits FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER tg_provider_limits_updated BEFORE UPDATE ON public.provider_limits
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  beta boolean NOT NULL DEFAULT false,
  maintenance_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_read_authed" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "feature_flags_admin_write" ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER tg_feature_flags_updated BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.workspace_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean,
  limit_override integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, feature_key)
);
GRANT SELECT ON public.workspace_feature_overrides TO authenticated;
GRANT ALL ON public.workspace_feature_overrides TO service_role;
ALTER TABLE public.workspace_feature_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wfo_read_members" ON public.workspace_feature_overrides FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "wfo_admin_write" ON public.workspace_feature_overrides FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER tg_wfo_updated BEFORE UPDATE ON public.workspace_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS webhook_verify_token text,
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_ok boolean;

ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_workspace_id_kind_provider_key;
CREATE UNIQUE INDEX IF NOT EXISTS integrations_workspace_provider_account_uidx
  ON public.integrations (workspace_id, kind, provider, COALESCE(provider_account_id, id::text));

CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider_code text NOT NULL,
  event_type text,
  signature_valid boolean NOT NULL DEFAULT false,
  status_code integer,
  payload_hash text,
  error text,
  attempt_count integer NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX webhook_logs_integration_received_idx ON public.webhook_logs (integration_id, received_at DESC);
CREATE INDEX webhook_logs_workspace_received_idx ON public.webhook_logs (workspace_id, received_at DESC);
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_logs_read_members" ON public.webhook_logs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.provider_status (
  integration_id uuid PRIMARY KEY REFERENCES public.integrations(id) ON DELETE CASCADE,
  last_delivery_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  retry_count integer NOT NULL DEFAULT 0,
  verification_status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_status TO authenticated;
GRANT ALL ON public.provider_status TO service_role;
ALTER TABLE public.provider_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_status_read_members" ON public.provider_status FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.integrations i
                 WHERE i.id = provider_status.integration_id
                   AND (public.is_workspace_member(i.workspace_id, auth.uid())
                        OR public.is_super_admin(auth.uid()))));
CREATE TRIGGER tg_provider_status_updated BEFORE UPDATE ON public.provider_status
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.provider_catalog (code, kind, name, description, setup_instructions, setup_fields, webhook_events, docs_url, sort_order) VALUES
  ('shopify','store','Shopify','Recover failed subscription and one-time payments from your Shopify store.','Create a custom app in Shopify admin, grant read_orders + read_customers scopes, install to your store, then paste the Admin API access token below.','[{"key":"access_token","label":"Admin API Access Token","type":"password","required":true},{"key":"shop_domain","label":"Shop Domain","type":"text","placeholder":"my-store.myshopify.com","required":true}]','["orders/paid","orders/create","customers/create"]','https://shopify.dev/docs/api',10),
  ('woocommerce','store','WooCommerce','Recover failed WooCommerce Subscriptions and one-time orders.','In WooCommerce, go to Settings → Advanced → REST API, create a new key with Read/Write scope, and paste it below along with your site URL.','[{"key":"site_url","label":"Site URL","type":"url","required":true},{"key":"consumer_key","label":"Consumer Key","type":"password","required":true},{"key":"consumer_secret","label":"Consumer Secret","type":"password","required":true}]','["order.failed","order.updated","subscription.payment_failed"]','https://woocommerce.github.io/woocommerce-rest-api-docs/',20),
  ('edd','store','Easy Digital Downloads','Recover failed EDD renewals and one-time downloads.','In EDD, go to Downloads → Settings → API Keys and generate a public + secret key pair.','[{"key":"site_url","label":"Site URL","type":"url","required":true},{"key":"public_key","label":"Public Key","type":"password","required":true},{"key":"secret_key","label":"Secret Key","type":"password","required":true}]','["edd_failed_payment","edd_subscription_failing"]','https://easydigitaldownloads.com/docs/edd-api-reference/',30),
  ('memberpress','store','MemberPress','Recover failed MemberPress subscription payments.','In MemberPress → Developer Tools → REST API, enable the API and generate a token.','[{"key":"site_url","label":"Site URL","type":"url","required":true},{"key":"api_key","label":"API Key","type":"password","required":true}]','["subscription-expired","transaction-failed"]','https://docs.memberpress.com/article/294-developer-tools',40),
  ('surecart','store','SureCart','Recover failed SureCart subscription and order payments.','In SureCart → Settings → Advanced → API Keys, generate a Secret Key with read/write access.','[{"key":"secret_key","label":"Secret Key","type":"password","required":true}]','["invoice.payment_failed","subscription.canceled"]','https://developers.surecart.com/',50),
  ('custom_store','store','Custom Store API','Bring your own store platform via a signed webhook + REST endpoint.','Send POST webhooks to the URL below with your own HMAC-SHA256 signature in X-Signature.','[{"key":"endpoint_url","label":"Your Store Endpoint","type":"url","required":true},{"key":"api_key","label":"API Key","type":"password","required":true}]','["order.failed","subscription.failed"]',null,60),
  ('stripe','gateway','Stripe','Recover failed Stripe subscription and one-time payments in real time.','In the Stripe Dashboard, create a restricted key with read on charges, customers, invoices, and subscriptions. Add a webhook endpoint pointing at the URL below and paste its signing secret.','[{"key":"secret_key","label":"Secret Key","type":"password","required":true,"placeholder":"sk_live_..."}]','["charge.failed","invoice.payment_failed","customer.subscription.updated"]','https://stripe.com/docs/api',10),
  ('lemonsqueezy','gateway','Lemon Squeezy','Recover failed Lemon Squeezy subscription renewals.','In Lemon Squeezy → Settings → API, generate an API key. Add a webhook pointing at the URL below and paste the signing secret.','[{"key":"api_key","label":"API Key","type":"password","required":true}]','["subscription_payment_failed","subscription_updated","subscription_cancelled"]','https://docs.lemonsqueezy.com/api',20),
  ('paddle','gateway','Paddle','Recover failed Paddle Billing subscription payments.','In Paddle → Developer Tools → Authentication, create an API key with read scope. Set up a webhook destination pointing at the URL below.','[{"key":"api_key","label":"API Key","type":"password","required":true},{"key":"public_key","label":"Public Key","type":"textarea","required":false}]','["transaction.payment_failed","subscription.past_due"]','https://developer.paddle.com/api-reference/overview',30),
  ('paypal','gateway','PayPal','Recover failed PayPal subscription billing.','In PayPal Developer Dashboard, create REST API credentials, then subscribe to BILLING.SUBSCRIPTION.PAYMENT.FAILED webhooks at the URL below.','[{"key":"client_id","label":"Client ID","type":"text","required":true},{"key":"client_secret","label":"Client Secret","type":"password","required":true},{"key":"mode","label":"Mode","type":"select","options":["sandbox","live"],"required":true}]','["BILLING.SUBSCRIPTION.PAYMENT.FAILED","PAYMENT.CAPTURE.DENIED"]','https://developer.paypal.com/api/rest/',40),
  ('adyen','gateway','Adyen','Recover failed Adyen recurring payments.','In Adyen Customer Area, generate an API key and configure a Standard Webhook pointing at the URL below.','[{"key":"api_key","label":"API Key","type":"password","required":true},{"key":"merchant_account","label":"Merchant Account","type":"text","required":true},{"key":"hmac_key","label":"HMAC Key","type":"password","required":true}]','["AUTHORISATION","RECURRING_CONTRACT"]','https://docs.adyen.com/api-explorer/',50),
  ('custom_gateway','gateway','Custom Gateway','Bring your own payment gateway via a signed webhook.','Send POST webhooks to the URL below with an HMAC-SHA256 signature in X-Signature.','[{"key":"endpoint_url","label":"Your Gateway Endpoint","type":"url","required":false},{"key":"api_key","label":"API Key","type":"password","required":false}]','["payment.failed","subscription.past_due"]',null,60),
  ('resend','email','Resend','Send recovery emails via Resend.','Create an API key at resend.com/api-keys and verify a sender domain.','[{"key":"api_key","label":"API Key","type":"password","required":true,"placeholder":"re_..."},{"key":"from_domain","label":"From Domain","type":"text","required":true,"placeholder":"mail.example.com"}]','[]','https://resend.com/docs',10),
  ('sendgrid','email','SendGrid','Send recovery emails via SendGrid.','Create an API key with Mail Send scope in SendGrid → Settings → API Keys and verify a sender domain.','[{"key":"api_key","label":"API Key","type":"password","required":true},{"key":"from_domain","label":"From Domain","type":"text","required":true}]','[]','https://docs.sendgrid.com/api-reference',20),
  ('smtp','email','SMTP','Send recovery emails via any SMTP server.','Paste the SMTP host, port, and credentials from your provider.','[{"key":"host","label":"SMTP Host","type":"text","required":true},{"key":"port","label":"Port","type":"number","required":true},{"key":"username","label":"Username","type":"text","required":true},{"key":"password","label":"Password","type":"password","required":true},{"key":"from_domain","label":"From Domain","type":"text","required":true}]','[]',null,30),
  ('mailgun','email','Mailgun','Send recovery emails via Mailgun.','In Mailgun, create a Sending API key and verify a domain.','[{"key":"api_key","label":"API Key","type":"password","required":true},{"key":"from_domain","label":"Domain","type":"text","required":true},{"key":"region","label":"Region","type":"select","options":["us","eu"],"required":true}]','[]','https://documentation.mailgun.com/en/latest/api_reference.html',40),
  ('postmark','email','Postmark','Send recovery emails via Postmark.','In Postmark, create a Server API token and verify a sender signature or domain.','[{"key":"api_key","label":"Server API Token","type":"password","required":true},{"key":"from_domain","label":"From Domain","type":"text","required":true}]','[]','https://postmarkapp.com/developer',50),
  ('meta_wa','messaging','Meta WhatsApp Cloud API','Send WhatsApp recovery messages via Meta''s Cloud API.','In Meta for Developers, create a WhatsApp Business app, add a phone number, generate a permanent access token, and set the webhook URL below with the verify token you provide here.','[{"key":"phone_number_id","label":"Phone Number ID","type":"text","required":true},{"key":"business_account_id","label":"Business Account ID","type":"text","required":true},{"key":"access_token","label":"Access Token","type":"password","required":true},{"key":"verify_token","label":"Verify Token","type":"password","required":true}]','["messages","message_status"]','https://developers.facebook.com/docs/whatsapp/cloud-api',10),
  ('twilio_sms','messaging','Twilio SMS','Send SMS recovery messages via Twilio.','In Twilio Console, copy your Account SID and Auth Token and provision a messaging-capable phone number.','[{"key":"account_sid","label":"Account SID","type":"text","required":true},{"key":"auth_token","label":"Auth Token","type":"password","required":true},{"key":"from_number","label":"From Number","type":"text","required":true,"placeholder":"+15551234567"}]','["message.status"]','https://www.twilio.com/docs/sms',20),
  ('twilio_wa','messaging','Twilio WhatsApp','Send WhatsApp recovery messages via Twilio.','In Twilio, enable the WhatsApp sender and copy your Account SID + Auth Token. Use the whatsapp:+NNN format for the from number.','[{"key":"account_sid","label":"Account SID","type":"text","required":true},{"key":"auth_token","label":"Auth Token","type":"password","required":true},{"key":"from_number","label":"From WhatsApp Number","type":"text","required":true,"placeholder":"whatsapp:+15551234567"}]','["message.status"]','https://www.twilio.com/docs/whatsapp',30);

INSERT INTO public.provider_limits (plan_code, provider_kind, max_count) VALUES
  ('starter','store',1),('starter','gateway',1),('starter','email',1),('starter','messaging',1),
  ('growth','store',3),('growth','gateway',3),('growth','email',NULL),('growth','messaging',NULL),
  ('business','store',NULL),('business','gateway',NULL),('business','email',NULL),('business','messaging',NULL),
  ('enterprise','store',NULL),('enterprise','gateway',NULL),('enterprise','email',NULL),('enterprise','messaging',NULL);

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('maintenance_mode','Maintenance Mode','When on, non-admin users see a maintenance banner and destructive actions are disabled.', false),
  ('beta_features','Beta Features','Expose beta providers and features to workspaces.', false),
  ('experimental_ai','Experimental AI','Enable experimental AI recovery models.', false),
  ('provider_visibility','Provider Visibility','Whether to show disabled providers as "coming soon" instead of hiding them.', true);

CREATE OR REPLACE FUNCTION public.workspace_provider_limit(_workspace_id uuid, _kind text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ws AS (
    SELECT w.id, s.plan_id
    FROM public.workspaces w
    LEFT JOIN public.subscriptions s ON s.workspace_id = w.id AND s.status IN ('active','on_trial','past_due')
    WHERE w.id = _workspace_id
    LIMIT 1
  ),
  plan_code AS (
    SELECT COALESCE(p.code, 'starter') AS code FROM ws LEFT JOIN public.plans p ON p.id = ws.plan_id
  ),
  base AS (
    SELECT pl.max_count FROM public.provider_limits pl, plan_code
    WHERE pl.plan_code = plan_code.code AND pl.provider_kind = _kind LIMIT 1
  ),
  override AS (
    SELECT limit_override FROM public.workspace_feature_overrides
    WHERE workspace_id = _workspace_id AND feature_key = 'limit:' || _kind LIMIT 1
  )
  SELECT COALESCE((SELECT limit_override FROM override), (SELECT max_count FROM base));
$$;
