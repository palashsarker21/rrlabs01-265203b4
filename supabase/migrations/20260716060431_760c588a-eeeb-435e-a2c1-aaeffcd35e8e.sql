
-- 1) audit_logs: standardize on is_super_admin() wrapper
DROP POLICY IF EXISTS "audit_read_super_admin" ON public.audit_logs;
CREATE POLICY "audit_read_super_admin"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2) newsletter_subscribers: use is_super_admin, not 'admin' role
DROP POLICY IF EXISTS "Super admins can read newsletter subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Super admins can update newsletter subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Super admins can delete newsletter subscribers" ON public.newsletter_subscribers;

CREATE POLICY "Super admins can read newsletter subscribers"
  ON public.newsletter_subscribers
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update newsletter subscribers"
  ON public.newsletter_subscribers
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete newsletter subscribers"
  ON public.newsletter_subscribers
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 3) admin_job_queue_stats: revoke PUBLIC execute, allow only authenticated
REVOKE ALL ON FUNCTION public.admin_job_queue_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_job_queue_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_job_queue_stats() TO authenticated;
