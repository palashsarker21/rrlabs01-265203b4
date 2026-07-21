
-- 1) blog_authors: keep public read but strip user_id from column-level grants
REVOKE SELECT ON public.blog_authors FROM anon;
REVOKE SELECT ON public.blog_authors FROM authenticated;

GRANT SELECT (
  id, slug, display_name, title, bio, avatar_url,
  twitter, linkedin, website, created_at, updated_at
) ON public.blog_authors TO anon;

GRANT SELECT (
  id, slug, display_name, title, bio, avatar_url,
  twitter, linkedin, website, created_at, updated_at
) ON public.blog_authors TO authenticated;

-- Super admins retain full access via ALL policy + service_role grant
GRANT ALL ON public.blog_authors TO service_role;

-- 2) ai_prompt_versions: restrict SELECT to super admins only
DROP POLICY IF EXISTS "ai_prompt_versions read authenticated" ON public.ai_prompt_versions;

CREATE POLICY "ai_prompt_versions read super admin"
ON public.ai_prompt_versions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
