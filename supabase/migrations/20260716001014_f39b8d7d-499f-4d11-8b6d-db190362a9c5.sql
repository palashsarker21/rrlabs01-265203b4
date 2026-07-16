
-- ============================================================
-- Phase 4: Queue Manager — job_queue table
-- ============================================================

CREATE TABLE public.job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  moved_to_dlq_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_queue_status_chk CHECK (
    status IN ('pending','processing','completed','failed','dlq','cancelled')
  ),
  CONSTRAINT job_queue_queue_chk CHECK (length(queue) BETWEEN 1 AND 64),
  CONSTRAINT job_queue_type_chk CHECK (length(job_type) BETWEEN 1 AND 128)
);

CREATE INDEX idx_job_queue_status ON public.job_queue (status);
CREATE INDEX idx_job_queue_queue ON public.job_queue (queue);
CREATE INDEX idx_job_queue_scheduled ON public.job_queue (scheduled_for)
  WHERE status IN ('pending','processing');
CREATE INDEX idx_job_queue_workspace ON public.job_queue (workspace_id);
CREATE INDEX idx_job_queue_created ON public.job_queue (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_queue TO authenticated;
GRANT ALL ON public.job_queue TO service_role;

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view job queue"
  ON public.job_queue FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins manage job queue"
  ON public.job_queue FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_job_queue_updated_at
  BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Stats aggregation function (super-admin only)
CREATE OR REPLACE FUNCTION public.admin_job_queue_stats()
RETURNS TABLE(queue TEXT, status TEXT, count BIGINT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT j.queue, j.status, count(*)::bigint
      FROM public.job_queue j
     GROUP BY j.queue, j.status
     ORDER BY j.queue, j.status;
END;
$$;
