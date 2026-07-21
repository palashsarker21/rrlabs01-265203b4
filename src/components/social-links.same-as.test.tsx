// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SocialLinks } from "./social-links";
import { Route as RootRoute } from "@/routes/__root";
import { ENABLED_SOCIAL_PROFILES, SOCIAL_SAME_AS } from "@/lib/brand";

afterEach(() => cleanup());

interface JsonLdNode {
  "@type": string;
  sameAs?: unknown;
}

function extractOrganizationSameAs(): string[] {
  const head = (
    RootRoute.options as {
      head?: () => { scripts?: Array<{ type?: string; children?: string }> };
    }
  ).head?.();
  const scripts = head?.scripts ?? [];
  const ld = scripts.find((s) => s.type === "application/ld+json");
  expect(ld, "Root route must expose an application/ld+json script").toBeDefined();
  const parsed = JSON.parse(ld!.children!);
  const graph: JsonLdNode[] = parsed["@graph"] ?? [parsed];
  const org = graph.find((n) => n["@type"] === "Organization");
  expect(org, "JSON-LD @graph must include an Organization node").toBeDefined();
  expect(Array.isArray(org!.sameAs)).toBe(true);
  return org!.sameAs as string[];
}

function renderedHrefs(variant: "icons" | "list"): string[] {
  const { container } = render(<SocialLinks variant={variant} />);
  return Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
}

describe("JSON-LD sameAs is generated from ENABLED_SOCIAL_PROFILES (both variants)", () => {
  it("sameAs mirrors the SOCIAL_SAME_AS registry export", () => {
    expect(extractOrganizationSameAs()).toEqual([...SOCIAL_SAME_AS]);
  });

  it("sameAs equals ENABLED_SOCIAL_PROFILES hrefs in order", () => {
    expect(extractOrganizationSameAs()).toEqual(ENABLED_SOCIAL_PROFILES.map((p) => p.href));
  });

  for (const variant of ["icons", "list"] as const) {
    describe(`${variant} variant`, () => {
      it(`rendered ${variant} hrefs match JSON-LD sameAs exactly, in order`, () => {
        const hrefs = renderedHrefs(variant);
        const sameAs = extractOrganizationSameAs();
        expect(hrefs).toEqual(sameAs);
      });

      it(`rendered ${variant} hrefs form the same set as sameAs (no drift)`, () => {
        const hrefs = renderedHrefs(variant);
        const sameAs = extractOrganizationSameAs();
        expect(new Set(hrefs)).toEqual(new Set(sameAs));
        expect(hrefs.length).toBe(sameAs.length);
      });

      it(`every ${variant} href appears in sameAs and is normalized`, () => {
        const hrefs = renderedHrefs(variant);
        const sameAsSet = new Set(extractOrganizationSameAs());
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs) {
          expect(sameAsSet.has(href)).toBe(true);
          expect(href.startsWith("https://")).toBe(true);
          expect(href.endsWith("/")).toBe(false);
          const url = new URL(href);
          expect(url.hostname).toBe(url.hostname.toLowerCase());
          expect(url.hash).toBe("");
        }
      });

      it(`${variant} hrefs are unique (filtered/deduped upstream)`, () => {
        const hrefs = renderedHrefs(variant);
        expect(new Set(hrefs).size).toBe(hrefs.length);
      });
    });
  }

  it("both variants render the identical href list, matching sameAs", () => {
    const icons = renderedHrefs("icons");
    const list = renderedHrefs("list");
    const sameAs = extractOrganizationSameAs();
    expect(icons).toEqual(list);
    expect(icons).toEqual(sameAs);
  });
});
