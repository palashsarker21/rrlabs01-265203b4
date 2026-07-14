import type { BlogPostSummary, TocItem } from "@/lib/blog/types";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Search } from "lucide-react";
import { searchPosts } from "@/lib/blog/loader";
import { PostCard } from "@/components/blog/post-card";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/blog/search")({
  validateSearch: zodValidator(schema),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => ({
    q: deps.q,
    results: deps.q ? searchPosts(deps.q) : [],
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.q
          ? `Search: ${loaderData.q} — RRLabs Blog`
          : "Search — RRLabs Blog",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, results } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <header className="mb-10 max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Search the RRLabs blog
        </h1>
        <form action="/blog/search" className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
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
      {q ? (
        results.length ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"} for
              &ldquo;{q}&rdquo;
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((p: BlogPostSummary) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            No results for &ldquo;{q}&rdquo;. Try a different phrase.
          </p>
        )
      ) : (
        <p className="text-muted-foreground">
          Enter a query above to search the archive.
        </p>
      )}
    </main>
  );
}
