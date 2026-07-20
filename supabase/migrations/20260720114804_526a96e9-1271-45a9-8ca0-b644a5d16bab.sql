
DROP POLICY IF EXISTS "wm_insert_managers" ON public.workspace_members;
CREATE POLICY "wm_insert_managers" ON public.workspace_members
FOR INSERT TO authenticated
WITH CHECK (
  (
    public.can_manage_workspace(workspace_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      JOIN public.organizations o ON o.id = w.organization_id
      WHERE w.id = workspace_id
        AND o.owner_id = auth.uid()
        AND user_id = auth.uid()
    )
  )
  AND (
    role <> 'owner'
    OR public.workspace_role_of(workspace_id, auth.uid()) = 'owner'
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      JOIN public.organizations o ON o.id = w.organization_id
      WHERE w.id = workspace_id
        AND o.owner_id = auth.uid()
        AND user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "wm_update_managers" ON public.workspace_members;
CREATE POLICY "wm_update_managers" ON public.workspace_members
FOR UPDATE TO authenticated
USING (public.can_manage_workspace(workspace_id, auth.uid()))
WITH CHECK (
  public.can_manage_workspace(workspace_id, auth.uid())
  AND (
    role <> 'owner'
    OR public.workspace_role_of(workspace_id, auth.uid()) = 'owner'
    OR public.is_super_admin(auth.uid())
  )
);

REVOKE SELECT ON public.blog_authors FROM authenticated;
GRANT SELECT
  (id, slug, display_name, title, bio, avatar_url, twitter, linkedin, website, created_at, updated_at)
  ON public.blog_authors TO authenticated;
