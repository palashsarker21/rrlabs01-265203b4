import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getAllPosts } from "@/lib/blog/loader";
import { SITE_URL } from "@/lib/brand";

const BASE_URL = SITE_URL;


function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const posts = getAllPosts();
        const items = posts
          .map((p) => {
            const url = `${BASE_URL}/blog/${p.slug}`;
            return [
              `    <item>`,
              `      <title>${escapeXml(p.title)}</title>`,
              `      <link>${url}</link>`,
              `      <guid isPermaLink="true">${url}</guid>`,
              `      <description>${escapeXml(p.description)}</description>`,
              `      <pubDate>${new Date(p.publishDate).toUTCString()}</pubDate>`,
              `      <category>${escapeXml(p.category)}</category>`,
              `      <author>${escapeXml(p.author)}</author>`,
              `    </item>`,
            ].join("\n");
          })
          .join("\n");

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
          `  <channel>`,
          `    <title>Revenue Recovery Labs — Blog</title>`,
          `    <link>${BASE_URL}/blog</link>`,
          `    <description>AI-powered revenue recovery, failed-payment automation, and SaaS retention insights.</description>`,
          `    <language>en</language>`,
          `    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />`,
          items,
          `  </channel>`,
          `</rss>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
