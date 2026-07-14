-- Post-migration security assertions.
-- Fails the CI job if any invariant is violated.
\set ON_ERROR_STOP on

-- 1) Every public table must have RLS enabled.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO offending
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
   WHERE t.schemaname = 'public'
     AND NOT c.relrowsecurity;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Tables without RLS: %', offending;
  END IF;
END $$;

-- 2) No table in public grants write access to anon.
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

-- 3) SECURITY DEFINER functions in public must pin search_path.
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
    RAISE EXCEPTION 'SECURITY DEFINER without search_path: %', offending;
  END IF;
END $$;

SELECT 'security-checks: OK' AS status;
