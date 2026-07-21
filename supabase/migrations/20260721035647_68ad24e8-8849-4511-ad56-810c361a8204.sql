
-- Revoke EXECUTE from anon and PUBLIC on internal SECURITY DEFINER functions.
-- Trigger functions are invoked by the database, not the API, so no client needs EXECUTE.
REVOKE EXECUTE ON FUNCTION public.tg_alert_activation_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_alert_integration_error() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_alert_recovery_attempt_failed() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_alert_webhook_issue() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_workspace_change() FROM anon, PUBLIC;

-- Internal helpers only needed for signed-in callers or via RLS policy evaluation.
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.workspace_permissions_of(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_success_fee_statement(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_rls_test_suite() FROM anon, PUBLIC;
