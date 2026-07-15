
REVOKE EXECUTE ON FUNCTION public.workspace_provider_limit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_provider_limit(uuid, text) TO authenticated, service_role;

REVOKE SELECT ON public.blog_authors FROM anon;
GRANT SELECT (id, slug, display_name, title, bio, avatar_url, twitter, linkedin, website, created_at, updated_at)
  ON public.blog_authors TO anon;

DROP POLICY IF EXISTS "authors admin manage" ON public.blog_authors;
CREATE POLICY "authors admin manage" ON public.blog_authors
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "categories admin manage" ON public.blog_categories;
CREATE POLICY "categories admin manage" ON public.blog_categories
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tags admin manage" ON public.blog_tags;
CREATE POLICY "tags admin manage" ON public.blog_tags
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "media admin manage" ON public.blog_media;
CREATE POLICY "media admin manage" ON public.blog_media
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "post_tags admin manage" ON public.blog_post_tags;
CREATE POLICY "post_tags admin manage" ON public.blog_post_tags
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "revisions admin" ON public.blog_revisions;
CREATE POLICY "revisions admin" ON public.blog_revisions
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "posts admin read all" ON public.blog_posts;
CREATE POLICY "posts admin read all" ON public.blog_posts
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "posts admin write" ON public.blog_posts;
CREATE POLICY "posts admin write" ON public.blog_posts
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
