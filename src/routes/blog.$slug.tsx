import type { BlogPostSummary, TocItem } from "@/lib/blog/types";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Calendar, Clock, User, RefreshCw } from "lucide-react";
import {
  BlogPostLoadError,
  getAdjacentPosts,
  getPostBySlug,
  getPostLoadIssueBySlug,
  getRelatedPosts,
} from "@/lib/blog/loader";
import { PostCard, formatDate } from "@/components/blog/post-card";
import { BlogErrorState } from "@/components/blog/blog-error-state";
import { ShareButtons } from "@/components/blog/share-buttons";
import { NewsletterSignup } from "@/components/blog/newsletter-signup";
import { BRAND, SITE_URL } from "@/lib/brand";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPostBySlug(params.slug);
    const loadIssue = getPostLoadIssueBySlug(params.slug);
    if (loadIssue) throw new BlogPostLoadError(loadIssue);
    if (!post) throw notFound();
    return {
      post,
      related: getRelatedPosts(params.slug, 3),
      adjacent: getAdjacentPosts(params.slug),
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Article not found — RRLabs" }, { name: "robots", content: "noindex" }],
      };
    }
    const p = loaderData.post;
    const path = `/blog/${params.slug}`;
    const absoluteUrl = `${SITE_URL}${path}`;
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: p.title,
      description: p.seoDescription,
      author: { "@type": "Person", name: p.author },
      datePublished: p.publishDate,
      dateModified: p.lastModified,
      keywords: p.keywords.join(", "),
      articleSection: p.category,
      ...(p.featuredImage ? { image: p.featuredImage } : {}),
      mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl },
      publisher: {
        "@type": "Organization",
        name: BRAND.company,
        url: SITE_URL,
      },
    };
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        {
          "@type": "ListItem",
          position: 3,
          name: p.category,
          item: `${SITE_URL}/blog/category/${p.categorySlug}`,
        },
        { "@type": "ListItem", position: 4, name: p.title, item: absoluteUrl },
      ],
    };
    const meta = [
      { title: p.seoTitle },
      { name: "description", content: p.seoDescription },
      { name: "author", content: p.author },
      { name: "keywords", content: p.keywords.join(", ") },
      { property: "og:title", content: p.ogTitle },
      { property: "og:description", content: p.ogDescription },
      { property: "og:type", content: "article" },
      { property: "og:url", content: absoluteUrl },
      { property: "og:site_name", content: BRAND.name },
      { property: "article:published_time", content: p.publishDate },
      { property: "article:modified_time", content: p.lastModified },
      { property: "article:section", content: p.category },
      { property: "article:author", content: p.author },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: p.twitterTitle },
      { name: "twitter:description", content: p.twitterDescription },
    ];
    if (p.featuredImage) {
      meta.push({ property: "og:image", content: p.featuredImage });
      meta.push({ name: "twitter:image", content: p.featuredImage });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: p.canonical ?? absoluteUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(articleSchema),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: BlogPost,
  notFoundComponent: PostNotFound,
  errorComponent: PostError,
});

function BlogPost() {
  const { post, related, adjacent } = Route.useLoaderData();
  const shareUrl = `${SITE_URL}/blog/${post.slug}`;
  const modifiedIsSameAsPublished = post.lastModified === post.publishDate;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/blog" className="hover:text-primary">
              Blog
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              to="/blog/category/$category"
              params={{ category: post.categorySlug }}
              className="hover:text-primary"
            >
              {post.category}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {post.title}
          </li>
        </ol>
      </nav>

      <Link
        to="/blog"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All articles
      </Link>

      <header className="mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link
            to="/blog/category/$category"
            params={{ category: post.categorySlug }}
            className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary hover:bg-primary/15"
          >
            {post.category}
          </Link>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Published {formatDate(post.publishDate)}
          </span>
          {!modifiedIsSameAsPublished && (
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Updated {formatDate(post.lastModified)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {post.readingTime} min read
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" /> {post.author}
          </span>
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>
        {post.featuredImage && (
          <img
            src={post.featuredImage}
            alt={post.imageAlt}
            className="mt-8 aspect-[16/9] w-full rounded-2xl border border-border object-cover"
            loading="eager"
            decoding="async"
          />
        )}
        <div className="mt-6">
          <ShareButtons url={shareUrl} title={post.title} />
        </div>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_220px]">
        <article
          className="blog-content prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
        {post.toc.length > 0 && (
          <aside className="hidden lg:block" aria-label="Table of contents">
            <div className="sticky top-24">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                On this page
              </h2>
              <ul className="space-y-1.5 text-sm">
                {post.toc.map((item: TocItem) => (
                  <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
                    <a href={`#${item.id}`} className="text-muted-foreground hover:text-primary">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      <section className="mt-16 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          About the author
        </h2>
        <div className="mt-3 flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">{post.author}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {BRAND.company} researches subscription retention, failed-payment recovery, and
              billing infrastructure. Editorial pieces distill patterns we see across production
              deployments.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t border-border/60 pt-8">
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag: string, i: number) => (
            <Link
              key={tag}
              to="/blog/tag/$tag"
              params={{ tag: post.tagSlugs[i] }}
              className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              #{tag}
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <ShareButtons url={shareUrl} title={post.title} />
        </div>
      </footer>

      {(adjacent.previous || adjacent.next) && (
        <nav
          aria-label="Article navigation"
          className="mt-10 grid gap-4 border-t border-border/60 pt-6 sm:grid-cols-2"
        >
          {adjacent.previous ? (
            <Link
              to="/blog/$slug"
              params={{ slug: adjacent.previous.slug }}
              className="group rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                <ArrowLeft className="h-3 w-3" /> Previous
              </div>
              <div className="mt-2 text-sm font-medium text-foreground group-hover:text-primary">
                {adjacent.previous.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
          {adjacent.next ? (
            <Link
              to="/blog/$slug"
              params={{ slug: adjacent.next.slug }}
              className="group rounded-xl border border-border/70 bg-card p-4 text-right transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-end gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                Next <ArrowRight className="h-3 w-3" />
              </div>
              <div className="mt-2 text-sm font-medium text-foreground group-hover:text-primary">
                {adjacent.next.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}

      <div className="mt-12">
        <NewsletterSignup />
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Related reading
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {related.map((r: BlogPostSummary) => (
              <PostCard key={r.slug} post={r} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function PostNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold text-foreground">Article not found</h1>
      <p className="mt-3 text-muted-foreground">That article may have moved or been renamed.</p>
      <Link
        to="/blog"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to the blog
      </Link>
    </main>
  );
}

function PostError({ error }: { error: Error }) {
  if (error.name === "BlogPostLoadError") {
    return (
      <BlogErrorState
        title="Article could not be loaded"
        description="This article is temporarily unavailable."
        detail="Please return to the blog archive while we correct the post."
      />
    );
  }

  return (
    <BlogErrorState
      title="Article could not be loaded"
      description="We couldn't render this article right now."
      detail="Please refresh the page or return to the blog archive."
    />
  );
}
