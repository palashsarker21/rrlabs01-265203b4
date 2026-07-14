CREATE OR REPLACE FUNCTION public.provision_trial_workspace(
  _org_name text,
  _workspace_name text,
  _org_slug text,
  _workspace_slug text,
  _trial_days integer DEFAULT 14
)
RETURNS TABLE (workspace_id uuid, organization_id uuid, already_exists boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := (auth.jwt() ->> 'email');
  _existing_ws uuid;
  _existing_org uuid;
  _new_org uuid;
  _new_ws uuid;
  _now timestamptz := now();
  _trial_ends timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _trial_days IS NULL OR _trial_days < 1 OR _trial_days > 60 THEN
    RAISE EXCEPTION 'invalid trial length' USING ERRCODE = '22023';
  END IF;

  IF length(coalesce(trim(_org_name), '')) < 2
     OR length(coalesce(trim(_workspace_name), '')) < 2
     OR length(coalesce(trim(_org_slug), '')) < 2
     OR length(coalesce(trim(_workspace_slug), '')) < 2 THEN
    RAISE EXCEPTION 'invalid name or slug' USING ERRCODE = '22023';
  END IF;

  -- Idempotency: if the caller already owns a workspace, return it.
  SELECT wm.workspace_id
    INTO _existing_ws
    FROM public.workspace_members wm
   WHERE wm.user_id = _uid
     AND wm.role = 'owner'
   ORDER BY wm.created_at ASC NULLS LAST
   LIMIT 1;

  IF _existing_ws IS NOT NULL THEN
    SELECT w.organization_id INTO _existing_org
      FROM public.workspaces w
     WHERE w.id = _existing_ws;

    workspace_id := _existing_ws;
    organization_id := _existing_org;
    already_exists := true;
    RETURN NEXT;
    RETURN;
  END IF;

  _trial_ends := _now + make_interval(days => _trial_days);

  INSERT INTO public.organizations (slug, name, owner_id, billing_email)
  VALUES (trim(_org_slug), trim(_org_name), _uid, _email)
  RETURNING id INTO _new_org;

  INSERT INTO public.workspaces (
    organization_id, slug, name, status, setup_step,
    trial_started_at, trial_ends_at, subscription_status
  )
  VALUES (
    _new_org, trim(_workspace_slug), trim(_workspace_name), 'trial', 0,
    _now, _trial_ends, 'trialing'
  )
  RETURNING id INTO _new_ws;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_new_ws, _uid, 'owner');

  workspace_id := _new_ws;
  organization_id := _new_org;
  already_exists := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_trial_workspace(text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_trial_workspace(text, text, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.provision_trial_workspace(text, text, text, text, integer) FROM service_role;
GRANT EXECUTE ON FUNCTION public.provision_trial_workspace(text, text, text, text, integer) TO authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;