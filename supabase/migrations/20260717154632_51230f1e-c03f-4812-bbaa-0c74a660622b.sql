
-- Enums
DO $$ BEGIN
  CREATE TYPE public.alert_category AS ENUM ('recovery_failure','webhook_issue','activation_status','integration_error','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_severity AS ENUM ('info','warning','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_status AS ENUM ('open','acknowledged','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category public.alert_category NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'warning',
  status public.alert_status NOT NULL DEFAULT 'open',
  title text NOT NULL,
  message text,
  entity text,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_workspace_created_idx ON public.alerts (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_workspace_status_idx ON public.alerts (workspace_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS alerts_workspace_dedupe_uidx ON public.alerts (workspace_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'open';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_read_members" ON public.alerts FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "alerts_update_managers" ON public.alerts FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));
CREATE POLICY "alerts_delete_managers" ON public.alerts FOR DELETE TO authenticated
  USING (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE TRIGGER alerts_set_updated_at BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  category public.alert_category NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  min_severity public.alert_severity NOT NULL DEFAULT 'warning',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "np_own_all" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER np_set_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper: create alert with dedupe
CREATE OR REPLACE FUNCTION public.create_alert(
  _workspace_id uuid,
  _category public.alert_category,
  _severity public.alert_severity,
  _title text,
  _message text,
  _entity text,
  _entity_id text,
  _payload jsonb,
  _dedupe_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _dedupe_key IS NOT NULL THEN
    SELECT id INTO _id FROM public.alerts
     WHERE workspace_id = _workspace_id AND dedupe_key = _dedupe_key AND status = 'open'
     LIMIT 1;
    IF _id IS NOT NULL THEN
      UPDATE public.alerts SET updated_at = now(),
                               payload = _payload,
                               message = COALESCE(_message, message),
                               severity = _severity
       WHERE id = _id;
      RETURN _id;
    END IF;
  END IF;

  INSERT INTO public.alerts (workspace_id, category, severity, title, message, entity, entity_id, payload, dedupe_key)
  VALUES (_workspace_id, _category, _severity, _title, _message, _entity, _entity_id, COALESCE(_payload,'{}'::jsonb), _dedupe_key)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Trigger: recovery attempts failed
CREATE OR REPLACE FUNCTION public.tg_alert_recovery_attempt_failed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status::text IN ('failed','cancelled') AND (TG_OP='INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text) THEN
    PERFORM public.create_alert(
      NEW.workspace_id,
      'recovery_failure'::public.alert_category,
      'warning'::public.alert_severity,
      'Recovery attempt failed',
      COALESCE('Attempt on ' || COALESCE(NEW.channel::text,'channel') || ' failed', 'Recovery attempt did not deliver'),
      'recovery_attempt', NEW.id::text,
      jsonb_build_object('attempt_id', NEW.id, 'channel', NEW.channel, 'status', NEW.status),
      'recovery_attempt:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS alert_recovery_attempt_failed ON public.recovery_attempts;
CREATE TRIGGER alert_recovery_attempt_failed
AFTER INSERT OR UPDATE OF status ON public.recovery_attempts
FOR EACH ROW EXECUTE FUNCTION public.tg_alert_recovery_attempt_failed();

-- Trigger: integration errors (status became error)
CREATE OR REPLACE FUNCTION public.tg_alert_integration_error()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status::text = 'error' AND (TG_OP='INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text) THEN
    PERFORM public.create_alert(
      NEW.workspace_id,
      'integration_error'::public.alert_category,
      'critical'::public.alert_severity,
      NEW.provider || ' integration error',
      'The ' || NEW.provider || ' (' || NEW.kind || ') integration reported an error.',
      'integration', NEW.id::text,
      jsonb_build_object('integration_id', NEW.id, 'provider', NEW.provider, 'kind', NEW.kind),
      'integration_error:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS alert_integration_error ON public.integrations;
CREATE TRIGGER alert_integration_error
AFTER INSERT OR UPDATE OF status ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.tg_alert_integration_error();

-- Trigger: webhook_logs errors
CREATE OR REPLACE FUNCTION public.tg_alert_webhook_issue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  _ws := NULLIF(NEW.workspace_id, NULL);
  IF _ws IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.status_code, 0) >= 400 OR NEW.error IS NOT NULL THEN
    PERFORM public.create_alert(
      _ws,
      'webhook_issue'::public.alert_category,
      CASE WHEN COALESCE(NEW.status_code,0) >= 500 THEN 'critical'::public.alert_severity ELSE 'warning'::public.alert_severity END,
      'Webhook issue: ' || COALESCE(NEW.provider, 'provider'),
      COALESCE(NEW.error, 'Non-2xx response ('|| COALESCE(NEW.status_code::text,'n/a') ||')'),
      'webhook_log', NEW.id::text,
      jsonb_build_object('provider', NEW.provider, 'status_code', NEW.status_code),
      'webhook:' || COALESCE(NEW.provider,'x') || ':' || COALESCE(NEW.status_code::text,'x')
    );
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE _has_ws boolean; _has_err boolean; _has_status boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_logs' AND column_name='workspace_id') INTO _has_ws;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_logs' AND column_name='error') INTO _has_err;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_logs' AND column_name='status_code') INTO _has_status;
  IF _has_ws AND _has_err AND _has_status THEN
    EXECUTE 'DROP TRIGGER IF EXISTS alert_webhook_issue ON public.webhook_logs';
    EXECUTE 'CREATE TRIGGER alert_webhook_issue AFTER INSERT ON public.webhook_logs FOR EACH ROW EXECUTE FUNCTION public.tg_alert_webhook_issue()';
  END IF;
END $$;

-- Trigger: activation status changes (recovery_engine_enabled toggled)
CREATE OR REPLACE FUNCTION public.tg_alert_activation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.recovery_engine_enabled IS DISTINCT FROM NEW.recovery_engine_enabled THEN
    PERFORM public.create_alert(
      NEW.id,
      'activation_status'::public.alert_category,
      'info'::public.alert_severity,
      CASE WHEN NEW.recovery_engine_enabled THEN 'Recovery engine activated' ELSE 'Recovery engine deactivated' END,
      CASE WHEN NEW.recovery_engine_enabled
           THEN 'The recovery engine is now running for this workspace.'
           ELSE 'The recovery engine has been turned off. No new recovery events will be processed.' END,
      'workspace', NEW.id::text,
      jsonb_build_object('recovery_engine_enabled', NEW.recovery_engine_enabled),
      NULL
    );
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.create_alert(
      NEW.id,
      'activation_status'::public.alert_category,
      CASE WHEN NEW.status IN ('expired','cancelled','suspended') THEN 'critical' ELSE 'info' END::public.alert_severity,
      'Workspace status changed to ' || NEW.status::text,
      NULL,
      'workspace', NEW.id::text,
      jsonb_build_object('status', NEW.status),
      NULL
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS alert_activation_change ON public.workspaces;
CREATE TRIGGER alert_activation_change
AFTER UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.tg_alert_activation_change();
