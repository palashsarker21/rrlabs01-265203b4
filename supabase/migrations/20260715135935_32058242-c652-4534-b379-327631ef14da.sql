
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','revoked')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  expires_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  request_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_workspace_idx ON public.api_keys (workspace_id);
CREATE INDEX IF NOT EXISTS api_keys_status_idx ON public.api_keys (status);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON public.api_keys (key_prefix);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace managers can view their api keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (
    public.can_manage_workspace(workspace_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Workspace managers can create api keys"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_workspace(workspace_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Workspace managers can update their api keys"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (
    public.can_manage_workspace(workspace_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    public.can_manage_workspace(workspace_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Workspace managers can delete their api keys"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING (
    public.can_manage_workspace(workspace_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER api_keys_set_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
