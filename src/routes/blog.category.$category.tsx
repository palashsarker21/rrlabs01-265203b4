import type { BlogPostSummary, TocItem } from "@/lib/blog/types";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPostsByCategory, getAllCategories } from "@/lib/blog/loader";
import { PostCard } from "@/components/blog/post-card";

export const Route = createFileRoute("/blog/category/$category")({
  loader: ({ params }) => {
    const posts = getPostsByCategory(params.category);
    if (posts.length === 0) throw notFound();
    const meta = getAllCategories().find((c) => c.slug === params.category);
    return { posts, name: meta?.name ?? params.category };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.name ?? params.category;
    return {
      meta: [
        { title: `${name} — RRLabs Blog` },
        {
          name: "description",
          content: `Articles in the ${name} category on the RRLabs blog.`,
        },
        { property: "og:title", content: `${name} — RRLabs Blog` },
        { property: "og:url", content: `/blog/category/${params.category}` },
      ],
      links: [{ rel: "canonical", href: `/blog/category/${params.category}` }],
    };
  },
  component: CategoryPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold text-foreground">Category not found</h1>
      <Link to="/blog" className="mt-6 inline-block text-sm text-primary hover:underline">
        Back to the blog
      </Link>
    </main>
  ),
});

function CategoryPage() {
  const { posts, name } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Category</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{name}</h1>
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
