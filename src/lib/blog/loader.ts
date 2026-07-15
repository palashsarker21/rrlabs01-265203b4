/**
 * Markdown blog loader.
 *
 * Auto-discovers every .md file under /content/blog/ at build time via
 * Vite's import.meta.glob. No database, no manual registration.
 * Works on Cloudflare Workers because all markdown is inlined into the bundle.
 */
import { parseFrontmatter, FrontmatterParseError } from "./frontmatter";
import { parseMarkdown, calculateReadingTime, extractToc } from "./parse";
import type { BlogLoadIssue, BlogPost, BlogPostSummary, TocItem } from "./types";

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

interface BlogCache {
  posts: BlogPost[];
  issues: BlogLoadIssue[];
}

export class BlogPostLoadError extends Error {
  readonly issue: BlogLoadIssue;

  constructor(issue: BlogLoadIssue) {
    super(issue.reason);
    this.name = "BlogPostLoadError";
    this.issue = issue;
  }
}

let cache: BlogCache | null = null;

function issueReason(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The post could not be parsed.";
}

function kindFor(error: unknown): BlogLoadIssue["kind"] {
  return error instanceof FrontmatterParseError ? "frontmatter" : "markdown";
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string | number | boolean =>
      ["string", "number", "boolean"].includes(typeof item),
    )
    .map(String)
    .filter(Boolean);
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function loadBlogCache(): BlogCache {
  if (cache) return cache;
  const posts: BlogPost[] = [];
  const issues: BlogLoadIssue[] = [];

  for (const [filepath, raw] of Object.entries(rawModules)) {
    const fallbackSlug = fileToSlug(filepath);

    try {
      const parsed = parseFrontmatter(raw);
      const data = parsed.data as Record<string, unknown>;

      if (data.draft === true) continue;

      const slug = fileToSlug(filepath, asString(data.slug, ""));
      const title = asString(data.title, "Untitled");
      const description = asString(data.description, "");
      const category = asString(data.category, "General");
      const tags = asStringArray(data.tags);
      const author = asString(data.author, "RRLabs Editorial");
      const publishDate = asString(data.publishDate, "1970-01-01");
      const lastModified = asString(data.lastModified, publishDate);
      const featuredImage = asString(data.featuredImage, "") || null;
      const imageAlt = asString(data.imageAlt, title);
      const featured = asBoolean(data.featured);
      const keywords = asStringArray(data.keywords);

      const { html, plain } = parseMarkdown(parsed.content);
      const readingTime = asNumber(data.readingTime) ?? calculateReadingTime(plain);
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
        canonical: asString(data.canonical, "") || null,
        seoTitle: asString(data.seoTitle, title),
        seoDescription: asString(data.seoDescription, description),
        ogTitle: asString(data.ogTitle, title),
        ogDescription: asString(data.ogDescription, description),
        twitterTitle: asString(data.twitterTitle, title),
        twitterDescription: asString(data.twitterDescription, description),
        html,
        plain,
        toc,
        raw,
        source: parsed.content,
      });
    } catch (error) {
      issues.push({
        slug: fallbackSlug,
        filepath,
        title: fallbackSlug.replace(/-/g, " "),
        reason: issueReason(error),
        kind: kindFor(error),
      });
    }
  }

  posts.sort((a, b) => (a.publishDate < b.publishDate ? 1 : -1));
  if (issues.length > 0) {
    // Log server-side only. Never expose loader failures to end users.
    for (const issue of issues) {
      console.warn(`[blog] Skipped ${issue.filepath}: ${issue.reason}`);
    }
  }
  cache = { posts, issues };
  return cache;
}

export function getAdjacentPosts(slug: string): {
  previous: BlogPostSummary | null;
  next: BlogPostSummary | null;
} {
  const posts = loadAllPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx === -1) return { previous: null, next: null };
  // Posts sorted newest -> oldest. "Previous" = older (higher index), "Next" = newer (lower index).
  const previous = idx < posts.length - 1 ? toSummary(posts[idx + 1]) : null;
  const next = idx > 0 ? toSummary(posts[idx - 1]) : null;
  return { previous, next };
}

function loadAllPosts(): BlogPost[] {
  return loadBlogCache().posts;
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

export function getPostLoadIssueBySlug(slug: string): BlogLoadIssue | null {
  return loadBlogCache().issues.find((issue) => issue.slug === slug) ?? null;
}

export function getBlogLoadIssues(): BlogLoadIssue[] {
  return loadBlogCache().issues;
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
