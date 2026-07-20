
-- Wave A: Recovery Engine v2 foundation (additive only)

-- 1) Failure classification enum
DO $$ BEGIN
  CREATE TYPE public.failure_classification AS ENUM (
    'soft_decline','hard_decline','expired_card','insufficient_funds',
    'auth_required','incorrect_cvc','fraud_suspected','temporary_bank',
    'gateway_timeout','network_error','unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.template_source AS ENUM ('curated','ai_generated','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Extend recovery_events
ALTER TABLE public.recovery_events
  ADD COLUMN IF NOT EXISTS failure_classification public.failure_classification,
  ADD COLUMN IF NOT EXISTS recovery_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS risk_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS preferred_timezone text,
  ADD COLUMN IF NOT EXISTS notification_channel text,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS template_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS last_ai_version text,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS ai_processing_ms integer,
  ADD COLUMN IF NOT EXISTS ai_cost_micros bigint,
  ADD COLUMN IF NOT EXISTS decision jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS recovery_events_classification_idx
  ON public.recovery_events (workspace_id, failure_classification, created_at DESC);

-- 3) Extend recovery_attempts
ALTER TABLE public.recovery_attempts
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS read_status text,
  ADD COLUMN IF NOT EXISTS click_status text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_error_code text,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS language text;

-- 4) Extend recovery_templates for matching + learning
ALTER TABLE public.recovery_templates
  ADD COLUMN IF NOT EXISTS failure_classification public.failure_classification,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS product_kind text,
  ADD COLUMN IF NOT EXISTS customer_segment text,
  ADD COLUMN IF NOT EXISTS source public.template_source NOT NULL DEFAULT 'curated',
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS confidence numeric(5,4) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS prompt_version text;

CREATE INDEX IF NOT EXISTS recovery_templates_match_idx
  ON public.recovery_templates (workspace_id, step, channel, failure_classification, language, country);

-- 5) Extend customers with intelligence signals
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS preferred_timezone text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS clv_cents bigint,
  ADD COLUMN IF NOT EXISTS churn_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS segment text;

-- 6) workspace_automation_settings (new table)
CREATE TABLE IF NOT EXISTS public.workspace_automation_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  business_hours jsonb NOT NULL DEFAULT '{"mon":[9,18],"tue":[9,18],"wed":[9,18],"thu":[9,18],"fri":[9,18]}'::jsonb,
  quiet_hours jsonb NOT NULL DEFAULT '{"start":21,"end":8}'::jsonb,
  holiday_calendar jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_retries integer NOT NULL DEFAULT 3,
  preferred_channels text[] NOT NULL DEFAULT ARRAY['whatsapp','email','sms'],
  ai_enabled boolean NOT NULL DEFAULT true,
  retry_schedule_minutes integer[] NOT NULL DEFAULT ARRAY[15, 1440, 2880],
  template_reuse_threshold numeric(5,4) NOT NULL DEFAULT 0.72,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_automation_settings TO authenticated;
GRANT ALL ON public.workspace_automation_settings TO service_role;

ALTER TABLE public.workspace_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read automation settings"
  ON public.workspace_automation_settings FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "managers write automation settings"
  ON public.workspace_automation_settings FOR ALL TO authenticated
  USING (public.can_manage_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE TRIGGER workspace_automation_settings_set_updated_at
  BEFORE UPDATE ON public.workspace_automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7) recovery_template_matches (learning loop audit)
CREATE TABLE IF NOT EXISTS public.recovery_template_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.recovery_events(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.recovery_templates(id) ON DELETE SET NULL,
  step integer NOT NULL,
  channel public.recovery_channel NOT NULL,
  matched boolean NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  match_keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.recovery_template_matches TO authenticated;
GRANT ALL ON public.recovery_template_matches TO service_role;

ALTER TABLE public.recovery_template_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read template matches"
  ON public.recovery_template_matches FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "managers insert template matches"
  ON public.recovery_template_matches FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE INDEX IF NOT EXISTS recovery_template_matches_event_idx
  ON public.recovery_template_matches (event_id, step);
CREATE INDEX IF NOT EXISTS recovery_template_matches_template_idx
  ON public.recovery_template_matches (template_id, created_at DESC);
