
ALTER TABLE public.workspace_automation_settings
  ADD COLUMN IF NOT EXISTS brand_voice text NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS brand_voice_custom text,
  ADD COLUMN IF NOT EXISTS automation_mode text NOT NULL DEFAULT 'autopilot',
  ADD COLUMN IF NOT EXISTS max_discount_percent integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS escalation_rules jsonb NOT NULL DEFAULT '{"escalate_after_attempts": 2, "escalate_tone": "urgent", "notify_owner_on_final_failure": true}'::jsonb;

ALTER TABLE public.workspace_automation_settings
  ADD CONSTRAINT workspace_automation_settings_brand_voice_check
    CHECK (brand_voice IN ('professional','friendly','premium','luxury','custom'));
ALTER TABLE public.workspace_automation_settings
  ADD CONSTRAINT workspace_automation_settings_automation_mode_check
    CHECK (automation_mode IN ('autopilot','approval','manual'));
ALTER TABLE public.workspace_automation_settings
  ADD CONSTRAINT workspace_automation_settings_discount_check
    CHECK (max_discount_percent BETWEEN 0 AND 100);
