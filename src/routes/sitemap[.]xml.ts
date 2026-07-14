import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import {
  getAllPosts,
  getAllCategories,
  getAllTags,
} from "@/lib/blog/loader";

// TODO: replace with your project URL once a project name or custom domain is set.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/features", changefreq: "monthly", priority: "0.8" },
          { path: "/pricing", changefreq: "monthly", priority: "0.8" },
          { path: "/blog", changefreq: "daily", priority: "0.9" },
          { path: "/docs", changefreq: "weekly", priority: "0.7" },
          { path: "/about", changefreq: "yearly", priority: "0.5" },
          { path: "/contact", changefreq: "yearly", priority: "0.5" },
        ];

        for (const post of getAllPosts()) {
          entries.push({
            path: `/blog/${post.slug}`,
            lastmod: post.lastModified,
            changefreq: "monthly",
            priority: post.featured ? "0.8" : "0.7",
          });
        }
        for (const c of getAllCategories()) {
          entries.push({
            path: `/blog/category/${c.slug}`,
            changefreq: "weekly",
            priority: "0.5",
          });
        }
        for (const t of getAllTags()) {
          entries.push({
            path: `/blog/tag/${t.slug}`,
            changefreq: "weekly",
            priority: "0.4",
          });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

