
-- Audit log
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX audit_logs_workspace_idx ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs(action);

-- Super admins can read all rows
CREATE POLICY "audit_read_super_admin" ON public.audit_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Workspace managers can read their workspace's rows
CREATE POLICY "audit_read_workspace_managers" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  workspace_id IS NOT NULL
  AND public.can_manage_workspace(workspace_id, auth.uid())
);

-- Admin overview: aggregated stats per workspace, super admins only
CREATE OR REPLACE FUNCTION public.admin_workspace_overview()
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_slug TEXT,
  organization_id UUID,
  organization_name TEXT,
  status TEXT,
  recovery_engine_enabled BOOLEAN,
  members_count BIGINT,
  integrations_count BIGINT,
  active_integrations_count BIGINT,
  events_count BIGINT,
  recovered_count BIGINT,
  recovered_amount_cents BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.slug,
    w.organization_id,
    o.name,
    w.status::text,
    w.recovery_engine_enabled,
    (SELECT count(*) FROM public.workspace_members wm WHERE wm.workspace_id = w.id),
    (SELECT count(*) FROM public.integrations i WHERE i.workspace_id = w.id),
    (SELECT count(*) FROM public.integrations i WHERE i.workspace_id = w.id AND i.status = 'connected'),
    (SELECT count(*) FROM public.recovery_events re WHERE re.workspace_id = w.id),
    (SELECT count(*) FROM public.recovery_events re WHERE re.workspace_id = w.id AND re.status = 'recovered'),
    COALESCE((SELECT sum(re.amount_cents) FROM public.recovery_events re WHERE re.workspace_id = w.id AND re.status = 'recovered'), 0),
    w.created_at
  FROM public.workspaces w
  LEFT JOIN public.organizations o ON o.id = w.organization_id
  ORDER BY w.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_workspace_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_workspace_overview() TO authenticated;

-- Super-admin action: toggle recovery engine
CREATE OR REPLACE FUNCTION public.admin_set_workspace_engine(_workspace_id UUID, _enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.workspaces SET recovery_engine_enabled = _enabled, updated_at = now()
  WHERE id = _workspace_id;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_workspace_engine(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_workspace_engine(UUID, BOOLEAN) TO authenticated;
