
-- Team management: invitations table + helper policies

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wi_workspace_status_idx
  ON public.workspace_invitations(workspace_id, status);
CREATE INDEX IF NOT EXISTS wi_email_idx
  ON public.workspace_invitations(lower(email));

-- Only one live invite per (workspace, email)
CREATE UNIQUE INDEX IF NOT EXISTS wi_unique_pending_per_email
  ON public.workspace_invitations(workspace_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Managers (owner/admin) can read invitations for their workspace. Super admin sees all.
CREATE POLICY wi_read_managers
  ON public.workspace_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.can_manage_workspace(workspace_id, auth.uid())
  );

-- Managers can create invitations
CREATE POLICY wi_insert_managers
  ON public.workspace_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_workspace(workspace_id, auth.uid())
    AND invited_by = auth.uid()
  );

-- Managers can update (revoke) invitations for their workspace
CREATE POLICY wi_update_managers
  ON public.workspace_invitations
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()));

CREATE POLICY wi_delete_managers
  ON public.workspace_invitations
  FOR DELETE
  TO authenticated
  USING (public.can_manage_workspace(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS wi_set_updated_at ON public.workspace_invitations;
CREATE TRIGGER wi_set_updated_at
  BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Accept-invitation RPC: token-based, callable by any authenticated user.
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_token text)
RETURNS TABLE(workspace_id uuid, role public.workspace_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(auth.jwt() ->> 'email');
  _inv public.workspace_invitations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _inv FROM public.workspace_invitations
   WHERE token = _token
   LIMIT 1;

  IF _inv.id IS NULL THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = '22023';
  END IF;

  IF _inv.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation is % (no longer pending)', _inv.status USING ERRCODE = '22023';
  END IF;

  IF _inv.expires_at <= now() THEN
    UPDATE public.workspace_invitations SET status = 'expired', updated_at = now()
     WHERE id = _inv.id;
    RAISE EXCEPTION 'invitation has expired' USING ERRCODE = '22023';
  END IF;

  IF lower(_inv.email) <> COALESCE(_email, '') THEN
    RAISE EXCEPTION 'invitation email does not match signed-in user' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (_inv.workspace_id, _uid, _inv.role, _inv.invited_by)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = now();

  UPDATE public.workspace_invitations
     SET status = 'accepted', accepted_at = now(), accepted_by = _uid, updated_at = now()
   WHERE id = _inv.id;

  workspace_id := _inv.workspace_id;
  role := _inv.role;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_workspace_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text) TO authenticated;

-- Preview an invitation (safe subset) by token, for the /invite/$token landing.
CREATE OR REPLACE FUNCTION public.preview_workspace_invitation(_token text)
RETURNS TABLE(
  email text,
  role public.workspace_role,
  status text,
  expires_at timestamptz,
  workspace_name text,
  organization_name text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT wi.email, wi.role, wi.status, wi.expires_at,
         w.name, o.name
    FROM public.workspace_invitations wi
    JOIN public.workspaces w ON w.id = wi.workspace_id
    LEFT JOIN public.organizations o ON o.id = w.organization_id
   WHERE wi.token = _token
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.preview_workspace_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_workspace_invitation(text) TO authenticated;
