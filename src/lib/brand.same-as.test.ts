import { describe, it, expect } from "vitest";
import { SOCIAL_PROFILES, SOCIAL_SAME_AS } from "@/lib/brand";

/**
 * The Organization JSON-LD emitted in src/routes/__root.tsx sets
 * `sameAs: SOCIAL_SAME_AS`. These tests lock that list to exactly the
 * enabled official URLs from SOCIAL_PROFILES — the same set SocialLinks
 * renders — so the two surfaces never drift.
 */
describe("Organization JSON-LD sameAs", () => {
  const enabledHrefs = SOCIAL_PROFILES.filter((p) => p.enabled && p.href).map((p) => p.href);

  it("exactly matches the enabled official URLs (order preserved)", () => {
    expect([...SOCIAL_SAME_AS]).toEqual(enabledHrefs);
  });

  it("has the same length as the enabled profile list", () => {
    expect(SOCIAL_SAME_AS.length).toBe(enabledHrefs.length);
  });

  it("excludes every reserved (disabled) profile", () => {
    for (const p of SOCIAL_PROFILES.filter((x) => !x.enabled)) {
      expect(SOCIAL_SAME_AS).not.toContain(p.href);
    }
  });

  it("contains only absolute https URLs with no duplicates or blanks", () => {
    for (const href of SOCIAL_SAME_AS) {
      expect(href, "sameAs entry must be non-empty").toBeTruthy();
      expect(href.startsWith("https://"), `must be https: ${href}`).toBe(true);
    }
    expect(new Set(SOCIAL_SAME_AS).size).toBe(SOCIAL_SAME_AS.length);
  });
});
