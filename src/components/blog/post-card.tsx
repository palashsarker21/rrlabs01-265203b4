import { Link } from "@tanstack/react-router";
import { Calendar, Clock, Folder } from "lucide-react";
import type { BlogPostSummary } from "@/lib/blog/types";

export function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:border-primary/40">
      {post.featuredImage ? (
        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="block aspect-[16/9] overflow-hidden bg-muted"
        >
          <img
            src={post.featuredImage}
            alt={post.imageAlt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </Link>
      ) : (
        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-chart-2/10 text-xs uppercase tracking-widest text-muted-foreground"
        >
          {post.category}
        </Link>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link
            to="/blog/category/$category"
            params={{ category: post.categorySlug }}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary hover:bg-primary/15"
          >
            <Folder className="h-3 w-3" /> {post.category}
          </Link>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {formatDate(post.publishDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {post.readingTime} min
          </span>
        </div>
        <h3 className="text-lg font-semibold leading-snug text-foreground">
          <Link
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className="hover:text-primary"
          >
            {post.title}
          </Link>
        </h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {post.description}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {post.tags.slice(0, 4).map((tag, i) => (
            <Link
              key={tag}
              to="/blog/tag/$tag"
              params={{ tag: post.tagSlugs[i] }}
              className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
