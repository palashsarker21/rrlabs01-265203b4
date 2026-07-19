import { describe, it, expect } from "vitest";
import { buildPageMeta } from "./meta";
import { SITE_URL } from "@/lib/brand";

function findMeta(
  result: ReturnType<typeof buildPageMeta>,
  matcher: { name?: string; property?: string },
) {
  return result.meta.find(
    (m) =>
      (matcher.name && m.name === matcher.name) ||
      (matcher.property && m.property === matcher.property),
  );
}

describe("buildPageMeta", () => {
  const result = buildPageMeta({
    path: "/pricing",
    title: "Pricing — RRLabs",
    description: "Enterprise plans that grow with your revenue.",
  });

  it("produces a self-referencing canonical link", () => {
    expect(result.links).toEqual([{ rel: "canonical", href: `${SITE_URL}/pricing` }]);
  });

  it("keeps og:title in lock-step with title", () => {
    expect(findMeta(result, { property: "og:title" })?.content).toBe("Pricing — RRLabs");
    expect(findMeta(result, { name: "twitter:title" })?.content).toBe("Pricing — RRLabs");
  });

  it("keeps og:description in lock-step with description", () => {
    const d = "Enterprise plans that grow with your revenue.";
    expect(findMeta(result, { property: "og:description" })?.content).toBe(d);
    expect(findMeta(result, { name: "twitter:description" })?.content).toBe(d);
  });

  it("self-references og:url to the page path", () => {
    expect(findMeta(result, { property: "og:url" })?.content).toBe(`${SITE_URL}/pricing`);
  });

  it("defaults twitter:card to summary_large_image", () => {
    expect(findMeta(result, { name: "twitter:card" })?.content).toBe("summary_large_image");
  });

  it("resolves relative images to absolute URLs", () => {
    const r = buildPageMeta({
      path: "/blog/foo",
      title: "Foo",
      description: "Bar",
      image: "/covers/foo.png",
    });
    expect(findMeta(r, { property: "og:image" })?.content).toBe(`${SITE_URL}/covers/foo.png`);
  });

  it("passes through absolute image URLs unchanged", () => {
    const r = buildPageMeta({
      path: "/x",
      title: "X",
      description: "X",
      image: "https://cdn.example.com/i.jpg",
    });
    expect(findMeta(r, { property: "og:image" })?.content).toBe("https://cdn.example.com/i.jpg");
  });

  it("supports og:type=article for content pages", () => {
    const r = buildPageMeta({
      path: "/blog/foo",
      title: "Foo",
      description: "Bar",
      ogType: "article",
    });
    expect(findMeta(r, { property: "og:type" })?.content).toBe("article");
  });
});
