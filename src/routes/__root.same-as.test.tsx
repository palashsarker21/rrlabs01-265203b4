// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Route as RootRoute } from "@/routes/__root";
import { ENABLED_SOCIAL_PROFILES, SOCIAL_SAME_AS } from "@/lib/brand";

interface JsonLdNode {
  "@type": string;
  sameAs?: unknown;
}

function extractOrganizationSameAs(): string[] {
  const head = (
    RootRoute.options as { head?: () => { scripts?: Array<{ type?: string; children?: string }> } }
  ).head?.();
  const scripts = head?.scripts ?? [];
  const ld = scripts.find((s) => s.type === "application/ld+json");
  expect(ld, "Root route must include an application/ld+json script").toBeDefined();
  const parsed = JSON.parse(ld!.children!);
  const graph: JsonLdNode[] = parsed["@graph"] ?? [parsed];
  const org = graph.find((n) => n["@type"] === "Organization");
  expect(org, "JSON-LD @graph must contain an Organization node").toBeDefined();
  expect(Array.isArray(org!.sameAs), "Organization.sameAs must be an array").toBe(true);
  return org!.sameAs as string[];
}

describe("Organization JSON-LD sameAs", () => {
  it("matches SOCIAL_SAME_AS exactly (same order, same length)", () => {
    const sameAs = extractOrganizationSameAs();
    expect(sameAs).toEqual([...SOCIAL_SAME_AS]);
  });

  it("matches the sanitized ENABLED_SOCIAL_PROFILES hrefs used by SocialLinks", () => {
    const sameAs = extractOrganizationSameAs();
    expect(sameAs).toEqual(ENABLED_SOCIAL_PROFILES.map((p) => p.href));
  });

  it("contains only absolute https URLs and no duplicates", () => {
    const sameAs = extractOrganizationSameAs();
    expect(sameAs.length).toBeGreaterThan(0);
    expect(new Set(sameAs).size).toBe(sameAs.length);
    for (const url of sameAs) {
      expect(url.startsWith("https://")).toBe(true);
      expect(url.endsWith("/")).toBe(false);
    }
  });
});
