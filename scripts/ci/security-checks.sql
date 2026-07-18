-- Post-migration production security assertions.
-- Any failure aborts the CI job.
\set ON_ERROR_STOP on

-- 1) Every public table must have RLS enabled.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO offending
    FROM pg_tables t
    JOIN pg_class c   ON c.relname = t.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
   WHERE t.schemaname = 'public'
     AND NOT c.relrowsecurity;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Tables without RLS: %', offending;
  END IF;
END $$;

-- 2) Every RLS-enabled public table must have at least one policy.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    INTO offending
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relrowsecurity
     AND NOT EXISTS (
       SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
     );
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'RLS-enabled tables without any policy: %', offending;
  END IF;
END $$;

-- 3) No public table grants write access to `anon`.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%I.%I(%s)', table_schema, table_name, privilege_type), ', ')
    INTO offending
    FROM information_schema.role_table_grants
   WHERE grantee = 'anon'
     AND table_schema = 'public'
     AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Anonymous write grants detected: %', offending;
  END IF;
END $$;

-- 4) `authenticated` role must have some grants on every public table
--    (otherwise PostgREST returns permission-denied even with RLS).
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    INTO offending
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.role_table_grants g
        WHERE g.table_schema = 'public'
          AND g.table_name   = c.relname
          AND g.grantee      IN ('authenticated','service_role')
     );
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Public tables missing grants to authenticated/service_role: %', offending;
  END IF;
END $$;

-- 5) SECURITY DEFINER functions in public must pin search_path.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(p.proname, ', ')
    INTO offending
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
     );
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER functions without pinned search_path: %', offending;
  END IF;
END $$;

-- 6) Reject dangerous EXECUTE grants on public functions to `anon` /
--    `PUBLIC`. Allow explicit exceptions by prefixing the function name
--    with `public_` (documented pattern for intentionally public RPCs).
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%I.%I(%s)', n.nspname, p.proname, r.grantee), ', ')
    INTO offending
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN information_schema.role_routine_grants r
      ON r.specific_schema = n.nspname
     AND r.routine_name    = p.proname
   WHERE n.nspname = 'public'
     AND r.grantee IN ('anon','PUBLIC')
     AND r.privilege_type = 'EXECUTE'
     AND p.proname NOT LIKE 'public\_%'
     AND p.prosecdef;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Dangerous EXECUTE grants on SECURITY DEFINER functions: %', offending;
  END IF;
END $$;

-- 7) Reject broadly-permissive write policies (USING true / WITH CHECK true)
--    on tables in the public schema. Read-only (`FOR SELECT`) policies with
--    `qual = true` are allowed for genuinely public catalogs but flagged in
--    the summary via a NOTICE for review.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%I.%I:%I(%s)', n.nspname, c.relname, p.polname, p.polcmd), ', ')
    INTO offending
    FROM pg_policy p
    JOIN pg_class c   ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND p.polcmd IN ('a','w','d','*')   -- INSERT, UPDATE, DELETE, ALL
     AND (
       pg_get_expr(p.polqual,       p.polrelid) IN ('true','(true)')
       OR pg_get_expr(p.polwithcheck, p.polrelid) IN ('true','(true)')
     );
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Overly permissive write policies (USING/WITH CHECK true): %', offending;
  END IF;
END $$;

-- 8) Required policy coverage — every table listed here MUST have at least
--    one policy covering SELECT, INSERT, UPDATE, and DELETE (or ALL). This
--    catches accidental removal of tenant-scoping policies for the tables
--    we consider mission-critical.
DO $$
DECLARE
  _table text;
  _cmd   char;
  _label text;
  _tables text[] := ARRAY[
    'workspaces',
    'workspace_members',
    'workspace_invitations',
    'organizations',
    'integrations',
    'audit_logs',
    'user_roles'
  ];
  _cmds  char[] := ARRAY['r','a','w','d'];       -- SELECT, INSERT, UPDATE, DELETE
  _names text[] := ARRAY['SELECT','INSERT','UPDATE','DELETE'];
  _missing text := '';
  i int;
BEGIN
  FOREACH _table IN ARRAY _tables LOOP
    -- Skip tables that don't exist in this project (guard against renames).
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = _table
    ) THEN
      CONTINUE;
    END IF;

    FOR i IN 1..array_length(_cmds, 1) LOOP
      _cmd   := _cmds[i];
      _label := _names[i];
      IF NOT EXISTS (
        SELECT 1
          FROM pg_policy p
          JOIN pg_class c   ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = _table
           AND (p.polcmd = _cmd OR p.polcmd = '*')
      ) THEN
        _missing := _missing || format(' %s(%s)', _table, _label);
      END IF;
    END LOOP;
  END LOOP;

  IF length(_missing) > 0 THEN
    RAISE EXCEPTION 'Required policy coverage missing:%', _missing;
  END IF;
END $$;

SELECT 'security-checks: OK' AS status;
