
-- =========================================================
-- Blog CMS core schema
-- =========================================================

CREATE TYPE public.blog_post_status AS ENUM ('draft', 'scheduled', 'published', 'archived');

-- ---------- authors ----------
CREATE TABLE public.blog_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  avatar_url TEXT,
  twitter TEXT,
  linkedin TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_authors TO anon, authenticated;
GRANT ALL ON public.blog_authors TO service_role;
ALTER TABLE public.blog_authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authors readable to everyone" ON public.blog_authors FOR SELECT USING (true);
CREATE POLICY "authors admin manage" ON public.blog_authors FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_blog_authors_updated BEFORE UPDATE ON public.blog_authors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- categories ----------
CREATE TABLE public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  hero_image_url TEXT,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_categories TO anon, authenticated;
GRANT ALL ON public.blog_categories TO service_role;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable" ON public.blog_categories FOR SELECT USING (true);
CREATE POLICY "categories admin manage" ON public.blog_categories FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_blog_categories_updated BEFORE UPDATE ON public.blog_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- tags ----------
CREATE TABLE public.blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_tags TO anon, authenticated;
GRANT ALL ON public.blog_tags TO service_role;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags readable" ON public.blog_tags FOR SELECT USING (true);
CREATE POLICY "tags admin manage" ON public.blog_tags FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_blog_tags_updated BEFORE UPDATE ON public.blog_tags
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- posts ----------
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  cover_image_url TEXT,
  cover_image_alt TEXT,
  reading_time_min INT NOT NULL DEFAULT 5,
  status public.blog_post_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.blog_authors(id) ON DELETE SET NULL,
  seo_title TEXT,
  seo_description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  canonical_url TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  faq JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_jsonld JSONB,
  affiliate_enabled BOOLEAN NOT NULL DEFAULT false,
  affiliate_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  view_count BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_posts_status_pub ON public.blog_posts(status, published_at DESC);
CREATE INDEX idx_blog_posts_category ON public.blog_posts(category_id);
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts public read published" ON public.blog_posts FOR SELECT
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "posts admin read all" ON public.blog_posts FOR SELECT
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "posts admin write" ON public.blog_posts FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_blog_posts_updated BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- post <-> tag ----------
CREATE TABLE public.blog_post_tags (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
GRANT SELECT ON public.blog_post_tags TO anon, authenticated;
GRANT ALL ON public.blog_post_tags TO service_role;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_tags read" ON public.blog_post_tags FOR SELECT USING (true);
CREATE POLICY "post_tags admin manage" ON public.blog_post_tags FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- revisions ----------
CREATE TABLE public.blog_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_revisions_post ON public.blog_revisions(post_id, created_at DESC);
GRANT ALL ON public.blog_revisions TO service_role;
GRANT SELECT ON public.blog_revisions TO authenticated;
ALTER TABLE public.blog_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revisions admin" ON public.blog_revisions FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- media ----------
CREATE TABLE public.blog_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT,
  external_url TEXT,
  mime_type TEXT,
  width INT,
  height INT,
  alt TEXT,
  caption TEXT,
  credit TEXT,
  source TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_media TO anon, authenticated;
GRANT ALL ON public.blog_media TO service_role;
ALTER TABLE public.blog_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media read" ON public.blog_media FOR SELECT USING (true);
CREATE POLICY "media admin manage" ON public.blog_media FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_blog_media_updated BEFORE UPDATE ON public.blog_media
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- storage policies for blog-media bucket ----------
CREATE POLICY "blog-media admin read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-media' AND public.is_super_admin(auth.uid()));
CREATE POLICY "blog-media admin write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog-media' AND public.is_super_admin(auth.uid()));
CREATE POLICY "blog-media admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'blog-media' AND public.is_super_admin(auth.uid()));
CREATE POLICY "blog-media admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'blog-media' AND public.is_super_admin(auth.uid()));
