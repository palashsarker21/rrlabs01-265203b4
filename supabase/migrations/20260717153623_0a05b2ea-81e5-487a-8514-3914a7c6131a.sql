ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS provider_error text,
  ADD COLUMN IF NOT EXISTS provider_status_code integer,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS checkout_sessions_status_created_idx
  ON public.checkout_sessions (status, created_at DESC);