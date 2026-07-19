import { SITE_URL, absoluteUrl } from "@/lib/brand";

export interface BreadcrumbItem {
  name: string;
  path: string;
}

/**
 * Build a schema.org BreadcrumbList JSON-LD payload for a public page.
 *
 * Always prepends a "Home" crumb pointing at SITE_URL. Every item URL is
 * absolutized against SITE_URL so crawlers never see relative paths.
 *
 * Usage in a route `head()`:
 *
 *   scripts: [buildBreadcrumbScript([{ name: "Blog", path: "/blog" }])]
 */
export function buildBreadcrumbList(items: readonly BreadcrumbItem[]) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildBreadcrumbScript(items: readonly BreadcrumbItem[]) {
  return {
    type: "application/ld+json" as const,
    children: JSON.stringify(buildBreadcrumbList(items)),
  };
}

/** Convenience for the canonical URL of a public page. */
export function canonicalFor(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
