import type { BlogPostSummary, TocItem } from "@/lib/blog/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Sparkles } from "lucide-react";
import {
  getAllSummaries,
  getAllCategories,
  getAllTags,
  getFeaturedPosts,
  getBlogLoadIssues,
} from "@/lib/blog/loader";
import { PostCard } from "@/components/blog/post-card";
import { BlogErrorState } from "@/components/blog/blog-error-state";

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
  loader: () => ({
    posts: getAllSummaries(),
    featured: getFeaturedPosts(3),
    categories: getAllCategories(),
    tags: getAllTags().slice(0, 24),
    loadIssues: getBlogLoadIssues(),
  }),
  head: () => ({
    meta: [
      { title: "Blog — RRLabs · AI Revenue Recovery insights" },
      {
        name: "description",
        content:
          "Playbooks, engineering notes, and research on AI-powered revenue recovery, failed-payment automation, dunning, and SaaS retention.",
      },
      { property: "og:title", content: "RRLabs Blog" },
      {
        property: "og:description",
        content:
          "Deep, opinionated content on failed-payment recovery, subscription billing, and AI-assisted retention.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/blog" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/blog" }],
  }),
  errorComponent: BlogIndexError,
});

function BlogIndex() {
  const { posts, featured, categories, tags, loadIssues } = Route.useLoaderData();
  const latest = posts.slice(0, 12);

  if (posts.length === 0 && loadIssues.length > 0) {
    return (
      <BlogErrorState
        title="Blog temporarily unavailable"
        description="We couldn't load the article archive because the published content needs attention."
        detail="The team has been notified and the rest of the site is still available."
      />
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <header className="mb-12 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> RRLabs Journal
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Revenue recovery, in the open.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Playbooks, benchmarks, and engineering notes on AI-powered dunning,
          failed-payment automation, and subscription retention.
        </p>
        <form action="/blog/search" className="mt-6 flex max-w-lg gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              type="search"
              placeholder="Search articles…"
              className="w-full rounded-lg border border-border bg-card px-9 py-2 text-sm text-foreground outline-none focus:border-primary/60"
            />
          </div>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Search
          </button>
        </form>
      </header>

      {loadIssues.length > 0 && (
        <div className="mb-8 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Some articles could not be loaded and are temporarily hidden while we fix their content.
        </div>
      )}

      {featured.length > 0 && (
        <section className="mb-14">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Featured
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featured.map((p: BlogPostSummary) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-12 lg:grid-cols-[1fr_240px]">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Latest
            </h2>
            <span className="text-xs text-muted-foreground">
              {posts.length} article{posts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {latest.map((p: BlogPostSummary) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </section>

        <aside className="space-y-8">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Categories
            </h3>
            <ul className="space-y-1.5 text-sm">
              {categories.map((c: { name: string; slug: string; count: number }) => (
                <li key={c.slug}>
                  <Link
                    to="/blog/category/$category"
                    params={{ category: c.slug }}
                    className="flex items-center justify-between text-muted-foreground hover:text-primary"
                  >
                    <span>{c.name}</span>
                    <span className="text-xs">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t: { name: string; slug: string; count: number }) => (
                <Link
                  key={t.slug}
                  to="/blog/tag/$tag"
                  params={{ tag: t.slug }}
                  className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Feeds
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li>
                <a href="/rss.xml" className="text-muted-foreground hover:text-primary">
                  RSS feed
                </a>
              </li>
              <li>
                <a
                  href="/sitemap.xml"
                  className="text-muted-foreground hover:text-primary"
                >
                  Sitemap
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function BlogIndexError() {
  return (
    <BlogErrorState
      title="Blog temporarily unavailable"
      description="We couldn't load the article archive right now."
      detail="Please refresh the page or try again shortly."
    />
  );
}
