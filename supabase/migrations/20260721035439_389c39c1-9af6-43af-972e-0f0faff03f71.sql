
-- Restrict ai_routes and ai_models SELECT to super_admin only (accessed via supabaseAdmin server-side).
DROP POLICY IF EXISTS "ai_models read authenticated" ON public.ai_models;
DROP POLICY IF EXISTS "ai_routes read authenticated" ON public.ai_routes;

CREATE POLICY "ai_models read super admin" ON public.ai_models
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "ai_routes read super admin" ON public.ai_routes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Restrict support_presence SELECT to support staff or the user themselves.
DROP POLICY IF EXISTS "presence_read_all_authenticated" ON public.support_presence;

CREATE POLICY "presence_read_staff_or_self" ON public.support_presence
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_support_staff(auth.uid()));
