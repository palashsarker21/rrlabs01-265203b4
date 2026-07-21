
CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  base_url text NOT NULL,
  auth_header text NOT NULL DEFAULT 'Authorization',
  auth_scheme text NOT NULL DEFAULT 'Bearer',
  secret_env_var text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  supports_openai_compat boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_providers read authenticated" ON public.ai_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_providers write super admin" ON public.ai_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  model_id text NOT NULL,
  display_name text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('primary','secondary','premium','fallback','experimental')),
  input_price_per_mtok numeric(12,4) NOT NULL DEFAULT 0,
  output_price_per_mtok numeric(12,4) NOT NULL DEFAULT 0,
  context_window integer,
  supports_json boolean NOT NULL DEFAULT true,
  supports_tools boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, model_id)
);
GRANT SELECT ON public.ai_models TO authenticated;
GRANT ALL ON public.ai_models TO service_role;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_models read authenticated" ON public.ai_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_models write super admin" ON public.ai_models FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.ai_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL UNIQUE,
  description text,
  primary_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  secondary_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  premium_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  fallback_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  cache_enabled boolean NOT NULL DEFAULT false,
  cache_ttl_seconds integer NOT NULL DEFAULT 86400,
  timeout_ms integer NOT NULL DEFAULT 20000,
  max_retries integer NOT NULL DEFAULT 2,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_routes TO authenticated;
GRANT ALL ON public.ai_routes TO service_role;
ALTER TABLE public.ai_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_routes read authenticated" ON public.ai_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_routes write super admin" ON public.ai_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.ai_prompt_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  active_version_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_prompt_library TO authenticated;
GRANT ALL ON public.ai_prompt_library TO service_role;
ALTER TABLE public.ai_prompt_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_prompt_library read authenticated" ON public.ai_prompt_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_prompt_library write super admin" ON public.ai_prompt_library FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.ai_prompt_library(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  system_prompt text NOT NULL,
  user_template text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, version)
);
ALTER TABLE public.ai_prompt_library
  ADD CONSTRAINT ai_prompt_library_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES public.ai_prompt_versions(id) ON DELETE SET NULL;
GRANT SELECT ON public.ai_prompt_versions TO authenticated;
GRANT ALL ON public.ai_prompt_versions TO service_role;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_prompt_versions read authenticated" ON public.ai_prompt_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_prompt_versions write super admin" ON public.ai_prompt_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  task text NOT NULL,
  model_id text NOT NULL,
  response jsonb NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  hit_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz
);
CREATE INDEX ai_cache_expires_idx ON public.ai_cache (expires_at);
CREATE INDEX ai_cache_task_idx ON public.ai_cache (task);
GRANT ALL ON public.ai_cache TO service_role;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_cache super admin read" ON public.ai_cache FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task text NOT NULL,
  provider_slug text NOT NULL,
  model_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','error','cached','fallback','blocked')),
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  cached boolean NOT NULL DEFAULT false,
  fallback_used boolean NOT NULL DEFAULT false,
  attempt integer NOT NULL DEFAULT 1,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_workspace_idx ON public.ai_requests (workspace_id, created_at DESC);
CREATE INDEX ai_requests_task_idx ON public.ai_requests (task, created_at DESC);
CREATE INDEX ai_requests_created_idx ON public.ai_requests (created_at DESC);
GRANT SELECT ON public.ai_requests TO authenticated;
GRANT ALL ON public.ai_requests TO service_role;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_requests read own workspace" ON public.ai_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ai_requests.workspace_id AND wm.user_id = auth.uid()
    ))
  );

CREATE TABLE public.ai_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug text NOT NULL,
  up boolean NOT NULL,
  latency_ms integer,
  error_rate numeric(5,4),
  checked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ai_provider_health_slug_idx ON public.ai_provider_health (provider_slug, checked_at DESC);
GRANT SELECT ON public.ai_provider_health TO authenticated;
GRANT ALL ON public.ai_provider_health TO service_role;
ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_provider_health read super admin" ON public.ai_provider_health FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.organization_ai_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ai_enabled boolean NOT NULL DEFAULT true,
  cache_enabled boolean NOT NULL DEFAULT true,
  fallback_enabled boolean NOT NULL DEFAULT true,
  premium_enabled boolean NOT NULL DEFAULT false,
  monthly_budget_usd numeric(12,2),
  monthly_token_limit bigint,
  daily_budget_usd numeric(12,2),
  budget_alert_threshold numeric(3,2) NOT NULL DEFAULT 0.8,
  default_model text,
  custom_system_prompt text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organization_ai_settings TO authenticated;
GRANT ALL ON public.organization_ai_settings TO service_role;
ALTER TABLE public.organization_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_ai_settings members select" ON public.organization_ai_settings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = organization_ai_settings.workspace_id AND wm.user_id = auth.uid()
    )
  );
CREATE POLICY "org_ai_settings admins write" ON public.organization_ai_settings FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = organization_ai_settings.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = organization_ai_settings.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner','admin')
    )
  );

CREATE TRIGGER ai_providers_ua BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER ai_models_ua BEFORE UPDATE ON public.ai_models FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER ai_routes_ua BEFORE UPDATE ON public.ai_routes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER ai_prompt_library_ua BEFORE UPDATE ON public.ai_prompt_library FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER ai_prompt_versions_ua BEFORE UPDATE ON public.ai_prompt_versions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER org_ai_settings_ua BEFORE UPDATE ON public.organization_ai_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.ai_providers (slug, name, base_url, secret_env_var, priority, metadata) VALUES
  ('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY', 10, '{"docs":"https://openrouter.ai/docs"}'),
  ('lovable', 'Lovable AI Gateway', 'https://ai.gateway.lovable.dev/v1', 'LOVABLE_API_KEY', 20, '{}'),
  ('google', 'Google (via Lovable)', 'https://ai.gateway.lovable.dev/v1', 'LOVABLE_API_KEY', 30, '{}')
ON CONFLICT (slug) DO NOTHING;

WITH p AS (SELECT id, slug FROM public.ai_providers)
INSERT INTO public.ai_models (provider_id, model_id, display_name, tier, input_price_per_mtok, output_price_per_mtok, context_window, supports_json)
SELECT p.id, v.model_id, v.display_name, v.tier, v.inp, v.outp, v.ctx, v.json_ok
FROM (VALUES
  ('openrouter', 'deepseek/deepseek-chat-v3.1:free',  'DeepSeek Chat V3.1 (free)',        'primary',   0.00,  0.00,  131072, true),
  ('openrouter', 'deepseek/deepseek-chat',            'DeepSeek Chat',                     'primary',   0.14,  0.28,  131072, true),
  ('openrouter', 'google/gemini-flash-1.5-8b',        'Gemini Flash 1.5 8B (via OR)',      'secondary', 0.04,  0.15,  1000000, true),
  ('openrouter', 'google/gemini-2.5-flash',           'Gemini 2.5 Flash (via OR)',         'premium',   0.30,  2.50,  1000000, true),
  ('openrouter', 'openrouter/auto',                   'OpenRouter Auto Router',            'fallback',  0.50,  1.50,  128000, true),
  ('lovable',    'google/gemini-3-flash-preview',     'Gemini 3 Flash (Lovable)',          'premium',   0.00,  0.00,  1000000, true),
  ('lovable',    'google/gemini-2.5-flash-lite',      'Gemini 2.5 Flash Lite (Lovable)',   'secondary', 0.00,  0.00,  1000000, true)
) AS v(provider_slug, model_id, display_name, tier, inp, outp, ctx, json_ok)
JOIN p ON p.slug = v.provider_slug
ON CONFLICT (provider_id, model_id) DO NOTHING;

WITH m AS (
  SELECT ai_models.id, ai_models.model_id, ai_providers.slug AS provider_slug
  FROM public.ai_models JOIN public.ai_providers ON ai_providers.id = ai_models.provider_id
),
primary_m   AS (SELECT id FROM m WHERE model_id = 'deepseek/deepseek-chat-v3.1:free' LIMIT 1),
secondary_m AS (SELECT id FROM m WHERE model_id = 'google/gemini-2.5-flash-lite' AND provider_slug='lovable' LIMIT 1),
premium_m   AS (SELECT id FROM m WHERE model_id = 'google/gemini-3-flash-preview' LIMIT 1),
fallback_m  AS (SELECT id FROM m WHERE model_id = 'openrouter/auto' LIMIT 1)
INSERT INTO public.ai_routes (task, description, primary_model_id, secondary_model_id, premium_model_id, fallback_model_id, cache_enabled, cache_ttl_seconds)
SELECT v.task, v.description,
  (SELECT id FROM primary_m), (SELECT id FROM secondary_m),
  (SELECT id FROM premium_m), (SELECT id FROM fallback_m),
  v.cache_enabled, v.cache_ttl
FROM (VALUES
  ('recovery',        'Recovery message generation',    false, 0),
  ('email',           'Email copy generation',          false, 0),
  ('whatsapp',        'WhatsApp copy generation',       false, 0),
  ('sms',             'SMS copy generation',            false, 0),
  ('subject_line',    'Subject line generation',        true,  86400),
  ('translation',     'Text translation',                true,  604800),
  ('classification',  'Text classification',             true,  604800),
  ('language_detect', 'Language detection',              true,  604800),
  ('sentiment',       'Sentiment detection',             true,  86400),
  ('tone',            'Tone analysis',                   true,  86400),
  ('recommendation',  'Product recommendation',          false, 0),
  ('failure_analysis','Payment failure analysis',        true,  3600),
  ('reasoning',       'Complex reasoning tasks',         false, 0)
) AS v(task, description, cache_enabled, cache_ttl)
ON CONFLICT (task) DO NOTHING;

INSERT INTO public.ai_prompt_library (slug, name, category, description) VALUES
  ('recovery.message.v1', 'Recovery message', 'Recovery', 'Primary recovery message generation prompt'),
  ('email.subject.v1',    'Email subject line', 'Subject Line', 'Subject line generator for recovery emails'),
  ('translation.v1',      'Translation',        'Translation', 'Translate text preserving tone and variables'),
  ('classification.failure.v1', 'Failure classification', 'Classification', 'Classify payment failure codes')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.feature_flags (key, label, enabled, description) VALUES
  ('ai_kill_switch',      'AI kill switch',       false, 'Emergency kill switch that disables ALL AI calls platform-wide.'),
  ('ai_maintenance_mode', 'AI maintenance mode',  false, 'Puts the AI platform into maintenance mode (returns a friendly error).')
ON CONFLICT (key) DO NOTHING;
