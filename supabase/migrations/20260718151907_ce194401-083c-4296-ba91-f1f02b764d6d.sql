
CREATE TABLE public.email_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL DEFAULT 'resend',
  svix_id text,
  svix_timestamp text,
  event_type text,
  provider_message_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  outcome text NOT NULL,
  status_code integer NOT NULL,
  error text,
  processing_ms integer,
  matched_log_id uuid,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_snippet text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_webhook_logs_received ON public.email_webhook_logs (received_at DESC);
CREATE INDEX idx_email_webhook_logs_outcome ON public.email_webhook_logs (outcome, received_at DESC);
CREATE INDEX idx_email_webhook_logs_svix ON public.email_webhook_logs (svix_id);
CREATE INDEX idx_email_webhook_logs_msg ON public.email_webhook_logs (provider_message_id);

GRANT SELECT ON public.email_webhook_logs TO authenticated;
GRANT ALL ON public.email_webhook_logs TO service_role;

ALTER TABLE public.email_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_email_webhook_logs"
  ON public.email_webhook_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
