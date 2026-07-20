
-- =====================================================================
-- 1. Permissions catalog
-- =====================================================================
CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  category text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated, anon;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions readable by anyone" ON public.permissions FOR SELECT USING (true);

INSERT INTO public.permissions (key, category, description) VALUES
  ('recovery.read',      'recovery',     'View recovery events and attempts'),
  ('recovery.write',     'recovery',     'Create or edit recovery events and attempts'),
  ('recovery.retry',     'recovery',     'Manually retry a recovery attempt'),
  ('templates.read',     'recovery',     'View recovery templates'),
  ('templates.write',    'recovery',     'Create or edit recovery templates'),
  ('automation.read',    'recovery',     'View workspace automation settings'),
  ('automation.write',   'recovery',     'Edit workspace automation settings'),
  ('billing.read',       'billing',      'View billing statements and invoices'),
  ('billing.manage',     'billing',      'Manage plan, adjustments, and subscription'),
  ('integrations.read',  'integrations', 'View connected integrations'),
  ('integrations.write', 'integrations', 'Connect, edit, or remove integrations'),
  ('team.read',          'team',         'View team members and invitations'),
  ('team.manage',        'team',         'Invite, remove, or change roles of members'),
  ('analytics.read',     'analytics',    'View analytics dashboards'),
  ('workspace.manage',   'workspace',    'Edit workspace settings and delete workspace');

-- =====================================================================
-- 2. Role -> permission mapping
-- =====================================================================
CREATE TABLE public.role_permissions (
  role public.workspace_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated, anon;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions readable by anyone" ON public.role_permissions FOR SELECT USING (true);

-- Owner: everything
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'owner'::public.workspace_role, key FROM public.permissions;

-- Admin: everything except workspace.manage stays reserved... actually give admin workspace.manage too
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'admin'::public.workspace_role, key FROM public.permissions;

-- Manager: operational
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('manager','recovery.read'),('manager','recovery.write'),('manager','recovery.retry'),
  ('manager','templates.read'),('manager','templates.write'),
  ('manager','automation.read'),('manager','automation.write'),
  ('manager','integrations.read'),('manager','integrations.write'),
  ('manager','team.read'),
  ('manager','billing.read'),
  ('manager','analytics.read');

-- Member: read + limited write
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('member','recovery.read'),('member','recovery.write'),
  ('member','templates.read'),
  ('member','automation.read'),
  ('member','integrations.read'),
  ('member','team.read'),
  ('member','billing.read'),
  ('member','analytics.read');

-- Viewer: read-only
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('viewer','recovery.read'),
  ('viewer','templates.read'),
  ('viewer','automation.read'),
  ('viewer','integrations.read'),
  ('viewer','team.read'),
  ('viewer','billing.read'),
  ('viewer','analytics.read');

-- =====================================================================
-- 3. Per-member overrides (grant or deny a single permission)
-- =====================================================================
CREATE TABLE public.workspace_member_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_member_permissions TO authenticated;
GRANT ALL ON public.workspace_member_permissions TO service_role;
ALTER TABLE public.workspace_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER wmp_set_updated_at BEFORE UPDATE ON public.workspace_member_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================================
-- 4. Core helper: has_permission
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _workspace_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- super admin bypass
    public.is_super_admin(_user_id)
    OR
    -- explicit override wins
    COALESCE(
      (SELECT granted FROM public.workspace_member_permissions
        WHERE workspace_id = _workspace_id
          AND user_id = _user_id
          AND permission_key = _permission
        LIMIT 1),
      -- fallback to role mapping
      EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        JOIN public.role_permissions rp ON rp.role = wm.role
        WHERE wm.workspace_id = _workspace_id
          AND wm.user_id = _user_id
          AND rp.permission_key = _permission
      )
    )
$$;

-- Convenience: get all permissions for a user in a workspace
CREATE OR REPLACE FUNCTION public.workspace_permissions_of(
  _workspace_id uuid,
  _user_id uuid
)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH role_perms AS (
    SELECT rp.permission_key AS key
      FROM public.workspace_members wm
      JOIN public.role_permissions rp ON rp.role = wm.role
     WHERE wm.workspace_id = _workspace_id
       AND wm.user_id = _user_id
  ),
  overrides AS (
    SELECT permission_key AS key, granted
      FROM public.workspace_member_permissions
     WHERE workspace_id = _workspace_id
       AND user_id = _user_id
  ),
  denied AS (
    SELECT key FROM overrides WHERE granted = false
  ),
  granted_extra AS (
    SELECT key FROM overrides WHERE granted = true
  ),
  final_perms AS (
    SELECT key FROM role_perms
    UNION
    SELECT key FROM granted_extra
    EXCEPT
    SELECT key FROM denied
  )
  SELECT key FROM final_perms
  UNION
  SELECT p.key FROM public.permissions p WHERE public.is_super_admin(_user_id);
$$;

-- =====================================================================
-- 5. Overrides table policies (managers can view/edit for their workspace)
-- =====================================================================
CREATE POLICY "wmp_read_managers" ON public.workspace_member_permissions
  FOR SELECT
  USING (
    public.has_permission(auth.uid(), workspace_id, 'team.manage')
    OR user_id = auth.uid()
  );
CREATE POLICY "wmp_write_managers" ON public.workspace_member_permissions
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'team.manage'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'team.manage'));

-- =====================================================================
-- 6. Replace RLS on gated tables to use has_permission
-- =====================================================================

-- recovery_events
DROP POLICY IF EXISTS "workspace members read events" ON public.recovery_events;
DROP POLICY IF EXISTS "managers write events" ON public.recovery_events;
CREATE POLICY "recovery_events read" ON public.recovery_events
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'recovery.read'));
CREATE POLICY "recovery_events write" ON public.recovery_events
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'recovery.write'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'recovery.write'));

-- recovery_attempts
DROP POLICY IF EXISTS "workspace members read attempts" ON public.recovery_attempts;
DROP POLICY IF EXISTS "managers write attempts" ON public.recovery_attempts;
CREATE POLICY "recovery_attempts read" ON public.recovery_attempts
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'recovery.read'));
CREATE POLICY "recovery_attempts write" ON public.recovery_attempts
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'recovery.write'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'recovery.write'));

-- recovery_templates
DROP POLICY IF EXISTS "workspace members read templates" ON public.recovery_templates;
DROP POLICY IF EXISTS "managers write templates" ON public.recovery_templates;
CREATE POLICY "recovery_templates read" ON public.recovery_templates
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'templates.read'));
CREATE POLICY "recovery_templates write" ON public.recovery_templates
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'templates.write'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'templates.write'));

-- integrations
DROP POLICY IF EXISTS "integrations_read_members" ON public.integrations;
DROP POLICY IF EXISTS "integrations_write_managers" ON public.integrations;
CREATE POLICY "integrations read" ON public.integrations
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'integrations.read'));
CREATE POLICY "integrations write" ON public.integrations
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'integrations.write'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'integrations.write'));

-- workspace_automation_settings
DROP POLICY IF EXISTS "members read automation settings" ON public.workspace_automation_settings;
DROP POLICY IF EXISTS "managers write automation settings" ON public.workspace_automation_settings;
CREATE POLICY "automation read" ON public.workspace_automation_settings
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'automation.read'));
CREATE POLICY "automation write" ON public.workspace_automation_settings
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'automation.write'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'automation.write'));

-- success_fee_statements (add manage policy, keep members read via billing.read)
DROP POLICY IF EXISTS "success_fee_statements_read_members" ON public.success_fee_statements;
CREATE POLICY "billing read statements" ON public.success_fee_statements
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'billing.read'));
CREATE POLICY "billing manage statements" ON public.success_fee_statements
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'billing.manage'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'billing.manage'));

-- workspace_invitations (team.manage)
DROP POLICY IF EXISTS "wi_read_managers" ON public.workspace_invitations;
DROP POLICY IF EXISTS "wi_insert_managers" ON public.workspace_invitations;
DROP POLICY IF EXISTS "wi_update_managers" ON public.workspace_invitations;
DROP POLICY IF EXISTS "wi_delete_managers" ON public.workspace_invitations;
CREATE POLICY "invitations read" ON public.workspace_invitations
  FOR SELECT USING (public.has_permission(auth.uid(), workspace_id, 'team.read'));
CREATE POLICY "invitations manage" ON public.workspace_invitations
  FOR ALL
  USING (public.has_permission(auth.uid(), workspace_id, 'team.manage'))
  WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'team.manage'));
