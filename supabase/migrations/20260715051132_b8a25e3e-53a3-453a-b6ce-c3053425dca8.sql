ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS monthly_event_limit integer;
UPDATE public.plans SET monthly_event_limit = 500   WHERE code = 'starter';
UPDATE public.plans SET monthly_event_limit = 2500  WHERE code = 'growth';
UPDATE public.plans SET monthly_event_limit = 10000 WHERE code = 'business';
UPDATE public.plans SET monthly_event_limit = NULL  WHERE code = 'enterprise';

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  kind text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  recipient text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_logs_workspace_idx ON public.notification_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_logs_kind_idx ON public.notification_logs (kind, created_at DESC);

GRANT SELECT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_logs_super_admin_read"
  ON public.notification_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "notification_logs_workspace_read"
  ON public.notification_logs FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.can_manage_workspace(workspace_id, auth.uid()));