// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SocialLinks } from "./social-links";
import { ENABLED_SOCIAL_PROFILES, SOCIAL_PROFILES, normalizeSocialUrl } from "@/lib/brand";

afterEach(() => cleanup());

function anchorHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
}

describe("SocialLinks anchor hrefs", () => {
  it("icons variant hrefs equal the normalized ENABLED_SOCIAL_PROFILES list in order", () => {
    const { container } = render(<SocialLinks variant="icons" />);
    const hrefs = anchorHrefs(container);
    const expected = ENABLED_SOCIAL_PROFILES.map((p) => p.href);
    expect(hrefs).toEqual(expected);
  });

  it("list variant hrefs equal the normalized ENABLED_SOCIAL_PROFILES list in order", () => {
    const { container } = render(<SocialLinks variant="list" />);
    const hrefs = anchorHrefs(container);
    const expected = ENABLED_SOCIAL_PROFILES.map((p) => p.href);
    expect(hrefs).toEqual(expected);
  });

  it("every rendered href is a normalized https URL (no trailing slash, lower-case host)", () => {
    for (const variant of ["icons", "list"] as const) {
      const { container } = render(<SocialLinks variant={variant} />);
      for (const href of anchorHrefs(container)) {
        expect(href).toBe(normalizeSocialUrl(href));
        expect(href.startsWith("https://")).toBe(true);
        expect(href.endsWith("/")).toBe(false);
      }
      cleanup();
    }
  });

  it("never renders any disabled or empty-href profile from SOCIAL_PROFILES", () => {
    const disallowed = SOCIAL_PROFILES.filter((p) => !p.enabled || !p.href).map((p) => p.href);
    for (const variant of ["icons", "list"] as const) {
      const { container } = render(<SocialLinks variant={variant} />);
      const hrefs = anchorHrefs(container);
      for (const href of hrefs) {
        expect(disallowed).not.toContain(href);
        expect(href).not.toBe("");
      }
      cleanup();
    }
  });

  it("respects the platforms filter and still uses normalized hrefs", () => {
    const filter = ["github", "linkedin"] as const;
    const { container } = render(<SocialLinks platforms={filter} />);
    const hrefs = anchorHrefs(container);
    const expected = filter
      .map((k) => ENABLED_SOCIAL_PROFILES.find((p) => p.platform === k)?.href)
      .filter((h): h is string => Boolean(h));
    expect(hrefs).toEqual(expected);
  });

  it("deduplicates hrefs across all rendered anchors", () => {
    for (const variant of ["icons", "list"] as const) {
      const { container } = render(<SocialLinks variant={variant} />);
      const hrefs = anchorHrefs(container);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      cleanup();
    }
  });
});
