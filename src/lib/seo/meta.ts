/**
 * Single source of truth for per-route Open Graph / Twitter / canonical meta.
 *
 * Every public leaf route SHOULD call `buildPageMeta` in its `head()` so the
 * OG and Twitter twins stay in lock-step with `title` / `description` and the
 * canonical URL always self-references the page (never the homepage).
 *
 * Backward compatible: this helper only produces meta entries; call sites are
 * free to spread additional entries around it.
 */
import { SITE_URL, absoluteUrl, LOGO } from "@/lib/brand";
import { canonicalFor } from "@/lib/seo/breadcrumbs";

export interface PageMetaInput {
  /** Route path, e.g. "/pricing". Leading slash required. */
  path: string;
  /** Full <title>. */
  title: string;
  /** <meta name="description">. */
  description: string;
  /**
   * Absolute or root-relative image URL. Defaults to the sitewide OG image
   * (LOGO.ogImage) which is already an absolute URL.
   */
  image?: string;
  /** og:type override (default "website"; use "article" for posts). */
  ogType?: "website" | "article" | "product";
  /** twitter:card override (default "summary_large_image"). */
  twitterCard?: "summary" | "summary_large_image";
}

export interface PageMetaResult {
  meta: Array<{ title?: string; name?: string; property?: string; content?: string }>;
  links: Array<{ rel: string; href: string }>;
}

function absImage(image?: string): string {
  if (!image) return absoluteUrl(LOGO.ogImage);
  if (/^https?:\/\//i.test(image)) return image;
  return `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`;
}

/**
 * Build a consistent, self-referencing set of `<meta>` and `<link>` entries
 * for a public page. Returns the arrays; the caller merges into `head()`.
 */
export function buildPageMeta(input: PageMetaInput): PageMetaResult {
  const url = canonicalFor(input.path);
  const image = absImage(input.image);
  const ogType = input.ogType ?? "website";
  const twitterCard = input.twitterCard ?? "summary_large_image";

  return {
    meta: [
      { title: input.title },
      { name: "description", content: input.description },
      { property: "og:type", content: ogType },
      { property: "og:url", content: url },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:image", content: image },
      { name: "twitter:card", content: twitterCard },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
