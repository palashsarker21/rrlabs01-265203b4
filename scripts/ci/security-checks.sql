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

SELECT 'security-checks: OK' AS status;
