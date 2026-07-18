CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  template text NOT NULL,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  idempotency_key text UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz
);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_read_email_logs" ON public.email_logs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "workspace_read_email_logs" ON public.email_logs FOR SELECT TO authenticated USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_email_logs_workspace ON public.email_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs(created_at DESC);
CREATE TRIGGER tg_email_logs_updated BEFORE UPDATE ON public.email_logs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE CASCADE,
  provider_message_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_read_email_events" ON public.email_events FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_email_events_log ON public.email_events(email_log_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_msg ON public.email_events(provider_message_id);