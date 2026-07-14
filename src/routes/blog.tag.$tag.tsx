import type { BlogPostSummary, TocItem } from "@/lib/blog/types";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPostsByTag, getAllTags } from "@/lib/blog/loader";
import { PostCard } from "@/components/blog/post-card";

export const Route = createFileRoute("/blog/tag/$tag")({
  loader: ({ params }) => {
    const posts = getPostsByTag(params.tag);
    if (posts.length === 0) throw notFound();
    const meta = getAllTags().find((t) => t.slug === params.tag);
    return { posts, name: meta?.name ?? params.tag };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.name ?? params.tag;
    return {
      meta: [
        { title: `#${name} — RRLabs Blog` },
        {
          name: "description",
          content: `Articles tagged ${name} on the RRLabs blog.`,
        },
        { property: "og:title", content: `#${name} — RRLabs Blog` },
        { property: "og:url", content: `/blog/tag/${params.tag}` },
      ],
      links: [{ rel: "canonical", href: `/blog/tag/${params.tag}` }],
    };
  },
  component: TagPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold text-foreground">Tag not found</h1>
      <Link to="/blog" className="mt-6 inline-block text-sm text-primary hover:underline">
        Back to the blog
      </Link>
    </main>
  ),
});

function TagPage() {
  const { posts, name } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Tag</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">#{name}</h1>
        <p className="mt-2 text-muted-foreground">
          {posts.length} article{posts.length === 1 ? "" : "s"}
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((p: BlogPostSummary) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
    </main>
  );
}
