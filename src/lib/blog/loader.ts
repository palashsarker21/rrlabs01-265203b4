/**
 * Markdown blog loader.
 *
 * Auto-discovers every .md file under /content/blog/ at build time via
 * Vite's import.meta.glob. No database, no manual registration.
 * Works on Cloudflare Workers because all markdown is inlined into the bundle.
 */
import { parseFrontmatter } from "./frontmatter";
import { parseMarkdown, calculateReadingTime, extractToc } from "./parse";
import type { BlogPost, BlogPostSummary, TocItem } from "./types";

// Vite bundles every markdown file's raw source at build time.
const rawModules = import.meta.glob("/content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function fileToSlug(filepath: string, frontmatterSlug?: string): string {
  if (frontmatterSlug) return frontmatterSlug;
  const name = filepath.split("/").pop() ?? "";
  // Strip "NNN-" numeric prefix and .md suffix.
  return name.replace(/^\d+-/, "").replace(/\.md$/, "");
}

let cache: BlogPost[] | null = null;

function loadAllPosts(): BlogPost[] {
  if (cache) return cache;
  const posts: BlogPost[] = [];

  for (const [filepath, raw] of Object.entries(rawModules)) {
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;

    if (data.draft === true) continue;

    const slug = fileToSlug(filepath, data.slug as string | undefined);
    const title = (data.title as string) ?? "Untitled";
    const description = (data.description as string) ?? "";
    const category = (data.category as string) ?? "General";
    const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
    const author = (data.author as string) ?? "RRLabs Editorial";
    const publishDate =
      (data.publishDate as string) ?? new Date().toISOString().slice(0, 10);
    const lastModified = (data.lastModified as string) ?? publishDate;
    const featuredImage = (data.featuredImage as string) ?? null;
    const imageAlt = (data.imageAlt as string) ?? title;
    const featured = data.featured === true;
    const keywords = Array.isArray(data.keywords)
      ? (data.keywords as string[])
      : [];

    const { html, plain } = parseMarkdown(parsed.content);
    const readingTime =
      (data.readingTime as number | undefined) ?? calculateReadingTime(plain);
    const toc = extractToc(parsed.content);

    posts.push({
      slug,
      title,
      description,
      keywords,
      category,
      categorySlug: slugify(category),
      tags,
      tagSlugs: tags.map(slugify),
      author,
      publishDate,
      lastModified,
      readingTime,
      featuredImage,
      imageAlt,
      featured,
      canonical: (data.canonical as string | undefined) ?? null,
      seoTitle: (data.seoTitle as string | undefined) ?? title,
      seoDescription:
        (data.seoDescription as string | undefined) ?? description,
      ogTitle: (data.ogTitle as string | undefined) ?? title,
      ogDescription: (data.ogDescription as string | undefined) ?? description,
      twitterTitle: (data.twitterTitle as string | undefined) ?? title,
      twitterDescription:
        (data.twitterDescription as string | undefined) ?? description,
      html,
      plain,
      toc,
      raw,
      source: parsed.content,
    });
  }

  posts.sort((a, b) => (a.publishDate < b.publishDate ? 1 : -1));
  cache = posts;
  return posts;
}

export function getAllPosts(): BlogPost[] {
  return loadAllPosts();
}

export function getAllSummaries(): BlogPostSummary[] {
  return loadAllPosts().map(toSummary);
}

export function getPostBySlug(slug: string): BlogPost | null {
  return loadAllPosts().find((p) => p.slug === slug) ?? null;
}

export function getPostsByCategory(categorySlug: string): BlogPostSummary[] {
  return loadAllPosts()
    .filter((p) => p.categorySlug === categorySlug)
    .map(toSummary);
}

export function getPostsByTag(tagSlug: string): BlogPostSummary[] {
  return loadAllPosts()
    .filter((p) => p.tagSlugs.includes(tagSlug))
    .map(toSummary);
}

export function getFeaturedPosts(limit = 3): BlogPostSummary[] {
  const featured = loadAllPosts().filter((p) => p.featured);
  const list = featured.length ? featured : loadAllPosts();
  return list.slice(0, limit).map(toSummary);
}

export function getRelatedPosts(slug: string, limit = 3): BlogPostSummary[] {
  const post = getPostBySlug(slug);
  if (!post) return [];
  const scored = loadAllPosts()
    .filter((p) => p.slug !== slug)
    .map((p) => {
      let score = 0;
      if (p.categorySlug === post.categorySlug) score += 3;
      for (const t of p.tagSlugs) if (post.tagSlugs.includes(t)) score += 1;
      return { post: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const primary = scored.slice(0, limit).map((x) => toSummary(x.post));
  if (primary.length >= limit) return primary;
  // Backfill with latest posts if there aren't enough related ones.
  const seen = new Set([slug, ...primary.map((p) => p.slug)]);
  const fill = loadAllPosts()
    .filter((p) => !seen.has(p.slug))
    .slice(0, limit - primary.length)
    .map(toSummary);
  return [...primary, ...fill];
}

export function getAllCategories(): { name: string; slug: string; count: number }[] {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of loadAllPosts()) {
    const cur = map.get(p.categorySlug);
    if (cur) cur.count += 1;
    else map.set(p.categorySlug, { name: p.category, slug: p.categorySlug, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function getAllTags(): { name: string; slug: string; count: number }[] {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of loadAllPosts()) {
    p.tags.forEach((t: string, i: number) => {
      const s = p.tagSlugs[i];
      const cur = map.get(s);
      if (cur) cur.count += 1;
      else map.set(s, { name: t, slug: s, count: 1 });
    });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function searchPosts(q: string): BlogPostSummary[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return loadAllPosts()
    .filter((p) => {
      const hay = [
        p.title,
        p.description,
        p.plain,
        p.category,
        p.tags.join(" "),
        p.keywords.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .map(toSummary);
}

function toSummary(p: BlogPost): BlogPostSummary {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category,
    categorySlug: p.categorySlug,
    tags: p.tags,
    tagSlugs: p.tagSlugs,
    author: p.author,
    publishDate: p.publishDate,
    lastModified: p.lastModified,
    readingTime: p.readingTime,
    featuredImage: p.featuredImage,
    imageAlt: p.imageAlt,
    featured: p.featured,
  };
}

export type { BlogPost, BlogPostSummary, TocItem };
