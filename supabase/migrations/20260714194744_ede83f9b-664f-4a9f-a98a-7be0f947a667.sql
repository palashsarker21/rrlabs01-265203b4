-- Super admin auto-assignment for the platform owner (verified-email only).
CREATE OR REPLACE FUNCTION public.grant_super_admin_for_owner_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'palashsarker1993@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_owner
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_super_admin_for_owner_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_owner
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_super_admin_for_owner_email();

-- Backfill in case the owner already exists and is already verified.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'palashsarker1993@gmail.com'
  AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Trial / subscription enforcement helper.
-- Returns true when the workspace may run automation and send messages:
--   * status = 'active' (paid subscription), OR
--   * status = 'trial' AND trial_ends_at is in the future.
CREATE OR REPLACE FUNCTION public.workspace_can_send(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = _workspace_id
      AND w.recovery_engine_enabled = true
      AND (
        w.status = 'active'
        OR (w.status = 'trial' AND w.trial_ends_at IS NOT NULL AND w.trial_ends_at > now())
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.workspace_can_send(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_can_send(uuid) TO authenticated, service_role;

-- Nightly-safe expiry sweep: trial workspaces past trial_ends_at flip to 'expired'.
-- Callable by service_role (used by the recovery engine before dispatch, and by cron).
CREATE OR REPLACE FUNCTION public.expire_trial_workspaces()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  UPDATE public.workspaces
     SET status = 'expired', updated_at = now()
   WHERE status = 'trial'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_trial_workspaces() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_trial_workspaces() TO service_role;
