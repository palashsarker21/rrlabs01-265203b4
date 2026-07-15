-- 1. billing_events: add workspace-scoped read policy
CREATE POLICY "billing_events_read_workspace"
  ON public.billing_events
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND public.can_manage_workspace(workspace_id, auth.uid())
  );

-- 2. blog_authors: hide internal user_id from anonymous readers
REVOKE SELECT (user_id) ON public.blog_authors FROM anon;

-- 3. checkout_sessions: explicit restrictive policy so client writes are blocked even if
-- someone later adds a permissive policy. Service role bypasses RLS.
CREATE POLICY "checkout_sessions_no_client_insert"
  ON public.checkout_sessions AS RESTRICTIVE
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "checkout_sessions_no_client_update"
  ON public.checkout_sessions AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "checkout_sessions_no_client_delete"
  ON public.checkout_sessions AS RESTRICTIVE
  FOR DELETE TO authenticated, anon USING (false);

-- 4. Lock down SECURITY DEFINER functions that should not be publicly callable.
-- Admin + maintenance functions: service_role only.
REVOKE ALL ON FUNCTION public.admin_workspace_overview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_workspace_engine(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_trial_workspaces() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_workspace_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_workspace_engine(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_trial_workspaces() TO service_role;

-- Internal trigger functions: not callable from the API at all.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_super_admin_for_owner_email() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: authenticated only (needed at policy-eval time), never anon.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_workspace(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_can_send(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_can_send(uuid) TO authenticated, service_role;

-- provision_trial_workspace: signed-in users only (RPC entrypoint from onboarding).
REVOKE ALL ON FUNCTION public.provision_trial_workspace(text, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_trial_workspace(text, text, text, text, integer) TO authenticated, service_role;