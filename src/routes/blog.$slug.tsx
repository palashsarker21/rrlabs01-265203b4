import type { BlogPostSummary, TocItem } from "@/lib/blog/types";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import {
  BlogPostLoadError,
  getPostBySlug,
  getPostLoadIssueBySlug,
  getRelatedPosts,
} from "@/lib/blog/loader";
import { PostCard, formatDate } from "@/components/blog/post-card";
import { BlogErrorState } from "@/components/blog/blog-error-state";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPostBySlug(params.slug);
    const loadIssue = getPostLoadIssueBySlug(params.slug);
    if (loadIssue) throw new BlogPostLoadError(loadIssue);
    if (!post) throw notFound();
    return { post, related: getRelatedPosts(params.slug, 3) };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Article not found — RRLabs" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.post;
    const url = `/blog/${params.slug}`;
    const jsonLd = {
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
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      publisher: {
        "@type": "Organization",
        name: "Revenue Recovery Labs",
      },
    };
    const meta = [
      { title: p.seoTitle },
      { name: "description", content: p.seoDescription },
      { name: "author", content: p.author },
      { name: "keywords", content: p.keywords.join(", ") },
      { property: "og:title", content: p.ogTitle },
      { property: "og:description", content: p.ogDescription },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "article:published_time", content: p.publishDate },
      { property: "article:modified_time", content: p.lastModified },
      { property: "article:section", content: p.category },
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
      links: [{ rel: "canonical", href: p.canonical ?? url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },
  component: BlogPost,
  notFoundComponent: PostNotFound,
  errorComponent: PostError,
});

function BlogPost() {
  const { post, related } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
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
            <Calendar className="h-3 w-3" /> {formatDate(post.publishDate)}
          </span>
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
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_220px]">
        <article
          className="blog-content prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
        {post.toc.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                On this page
              </h2>
              <ul className="space-y-1.5 text-sm">
                {post.toc.map((item: TocItem) => (
                  <li
                    key={item.id}
                    style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
                  >
                    <a
                      href={`#${item.id}`}
                      className="text-muted-foreground hover:text-primary"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      <footer className="mt-16 border-t border-border/60 pt-8">
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
      </footer>

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
      <h1 className="text-3xl font-semibold text-foreground">
        Article not found
      </h1>
      <p className="mt-3 text-muted-foreground">
        That article may have moved or been renamed.
      </p>
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
        description="This article is temporarily unavailable because its content could not be parsed."
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
