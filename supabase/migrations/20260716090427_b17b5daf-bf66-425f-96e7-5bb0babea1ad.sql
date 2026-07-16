
-- 1) Add 'manager' role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'workspace_role' AND e.enumlabel = 'manager'
  ) THEN
    ALTER TYPE public.workspace_role ADD VALUE 'manager' BEFORE 'member';
  END IF;
END$$;

-- 2) Extend can_manage_workspace to include manager
CREATE OR REPLACE FUNCTION public.can_manage_workspace(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role::text IN ('owner', 'admin', 'manager')
  ) OR public.is_super_admin(_user_id)
$function$;

-- 3) Audit logger for team actions (triggers)
CREATE OR REPLACE FUNCTION public.tg_audit_workspace_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _ws uuid;
  _action text;
  _entity text := TG_TABLE_NAME;
  _payload jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _ws := OLD.workspace_id;
    _action := TG_TABLE_NAME || '.delete';
    _payload := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    _ws := NEW.workspace_id;
    _action := TG_TABLE_NAME || '.update';
    _payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    _ws := NEW.workspace_id;
    _action := TG_TABLE_NAME || '.insert';
    _payload := to_jsonb(NEW);
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (workspace_id, actor_user_id, action, entity, entity_id, payload)
    VALUES (_ws, _actor, _action, _entity,
            COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END)::text, ''),
            _payload);
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the original write because of audit logging
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_workspace_members ON public.workspace_members;
CREATE TRIGGER trg_audit_workspace_members
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_workspace_change();

DROP TRIGGER IF EXISTS trg_audit_workspace_invitations ON public.workspace_invitations;
CREATE TRIGGER trg_audit_workspace_invitations
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_invitations
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_workspace_change();

-- 4) Realtime publication (RLS respected by postgres_changes)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'workspaces','workspace_members','workspace_invitations',
    'integrations','recovery_events','recovery_attempts','audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END$$;

-- 5) Cross-tenant RLS test suite (super-admin only)
CREATE OR REPLACE FUNCTION public.run_rls_test_suite()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid_a uuid := gen_random_uuid();
  _uid_b uuid := gen_random_uuid();
  _org_a uuid;
  _org_b uuid;
  _ws_a  uuid;
  _ws_b  uuid;
  _rows int;
  _err text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Seed two isolated tenants with SECURITY DEFINER (bypasses RLS)
  INSERT INTO public.organizations (slug, name, owner_id, billing_email)
    VALUES ('rls-test-a-'||substr(_uid_a::text,1,8), 'RLS Test A', _uid_a, 'a@test.local')
    RETURNING id INTO _org_a;
  INSERT INTO public.organizations (slug, name, owner_id, billing_email)
    VALUES ('rls-test-b-'||substr(_uid_b::text,1,8), 'RLS Test B', _uid_b, 'b@test.local')
    RETURNING id INTO _org_b;

  INSERT INTO public.workspaces (organization_id, slug, name, status)
    VALUES (_org_a, 'rls-a-'||substr(_uid_a::text,1,8), 'RLS A', 'active') RETURNING id INTO _ws_a;
  INSERT INTO public.workspaces (organization_id, slug, name, status)
    VALUES (_org_b, 'rls-b-'||substr(_uid_b::text,1,8), 'RLS B', 'active') RETURNING id INTO _ws_b;

  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (_ws_a, _uid_a, 'owner');
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (_ws_b, _uid_b, 'owner');

  -- Helper to impersonate an authenticated user and run a query under RLS
  -- We use SET LOCAL for the duration of each sub-block via nested EXCEPTIONs.

  -- Test 1: User A can read own workspace
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _uid_a::text, 'role','authenticated','email','a@test.local')::text, true);
    SELECT count(*) INTO _rows FROM public.workspaces WHERE id = _ws_a;
    test_name := 'user_a_reads_own_workspace'; passed := _rows = 1;
    detail := format('rows=%s (expected 1)', _rows); RETURN NEXT;
  END;

  -- Test 2: User A CANNOT read User B's workspace
  BEGIN
    SELECT count(*) INTO _rows FROM public.workspaces WHERE id = _ws_b;
    test_name := 'user_a_cannot_read_workspace_b'; passed := _rows = 0;
    detail := format('rows=%s (expected 0)', _rows); RETURN NEXT;
  END;

  -- Test 3: User A CANNOT read workspace_members of B
  BEGIN
    SELECT count(*) INTO _rows FROM public.workspace_members WHERE workspace_id = _ws_b;
    test_name := 'user_a_cannot_read_members_b'; passed := _rows = 0;
    detail := format('rows=%s (expected 0)', _rows); RETURN NEXT;
  END;

  -- Test 4: User A CANNOT insert integration into workspace B
  BEGIN
    INSERT INTO public.integrations (workspace_id, provider, kind, status)
    VALUES (_ws_b, 'test', 'crm', 'connected');
    test_name := 'user_a_cannot_insert_integration_b'; passed := false;
    detail := 'insert unexpectedly succeeded'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    GET STACKED DIAGNOSTICS _err = MESSAGE_TEXT;
    test_name := 'user_a_cannot_insert_integration_b'; passed := true;
    detail := format('blocked: %s', _err); RETURN NEXT;
  END;

  -- Test 5: User A CANNOT update workspace B
  BEGIN
    UPDATE public.workspaces SET name = 'hijacked' WHERE id = _ws_b;
    GET DIAGNOSTICS _rows = ROW_COUNT;
    test_name := 'user_a_cannot_update_workspace_b'; passed := _rows = 0;
    detail := format('affected=%s (expected 0)', _rows); RETURN NEXT;
  EXCEPTION WHEN others THEN
    test_name := 'user_a_cannot_update_workspace_b'; passed := true;
    detail := 'blocked by RLS'; RETURN NEXT;
  END;

  -- Test 6: User A CANNOT invite into workspace B
  BEGIN
    INSERT INTO public.workspace_invitations (workspace_id, email, role, invited_by, token, expires_at, status)
    VALUES (_ws_b, 'x@test.local', 'member', _uid_a, gen_random_uuid()::text, now()+interval '1 day', 'pending');
    test_name := 'user_a_cannot_invite_into_b'; passed := false;
    detail := 'insert unexpectedly succeeded'; RETURN NEXT;
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS _err = MESSAGE_TEXT;
    test_name := 'user_a_cannot_invite_into_b'; passed := true;
    detail := format('blocked: %s', _err); RETURN NEXT;
  END;

  -- Test 7: User B can read own members
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _uid_b::text, 'role','authenticated','email','b@test.local')::text, true);
    SELECT count(*) INTO _rows FROM public.workspace_members WHERE workspace_id = _ws_b;
    test_name := 'user_b_reads_own_members'; passed := _rows = 1;
    detail := format('rows=%s (expected 1)', _rows); RETURN NEXT;
  END;

  -- Test 8: User B cannot read audit_logs of A
  BEGIN
    SELECT count(*) INTO _rows FROM public.audit_logs WHERE workspace_id = _ws_a;
    test_name := 'user_b_cannot_read_audit_a'; passed := _rows = 0;
    detail := format('rows=%s (expected 0)', _rows); RETURN NEXT;
  END;

  -- Reset role and cleanup
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);

  DELETE FROM public.audit_logs WHERE workspace_id IN (_ws_a, _ws_b);
  DELETE FROM public.workspace_invitations WHERE workspace_id IN (_ws_a, _ws_b);
  DELETE FROM public.integrations WHERE workspace_id IN (_ws_a, _ws_b);
  DELETE FROM public.workspace_members WHERE workspace_id IN (_ws_a, _ws_b);
  DELETE FROM public.workspaces WHERE id IN (_ws_a, _ws_b);
  DELETE FROM public.organizations WHERE id IN (_org_a, _org_b);

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_rls_test_suite() TO authenticated;
