
DROP POLICY IF EXISTS "ai_providers read authenticated" ON public.ai_providers;
CREATE POLICY "ai_providers read super admin" ON public.ai_providers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
