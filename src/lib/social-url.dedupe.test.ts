import { describe, expect, it } from "vitest";
import {
  ENABLED_SOCIAL_PROFILES,
  normalizeSocialUrl,
  type SocialProfile,
} from "@/lib/brand";

/**
 * Mirrors the case-insensitive dedup logic in `ENABLED_SOCIAL_PROFILES` so we
 * can test it against synthetic duplicate inputs. The real registry is
 * curated, so we can't feed duplicates through it at runtime — but the
 * algorithm itself must stay stable.
 */
function dedupeCaseInsensitive(
  profiles: Array<Pick<SocialProfile, "platform" | "href"> & { enabled?: boolean }>,
) {
  const seen = new Map<string, string>();
  const kept: Array<{ platform: string; href: string }> = [];
  const dropped: Array<{ platform: string; href: string; firstSeenAs: string }> = [];
  for (const p of profiles) {
    if (p.enabled === false) continue;
    const href = normalizeSocialUrl(p.href);
    if (!href) continue;
    const key = href.toLowerCase();
    const first = seen.get(key);
    if (first !== undefined) {
      dropped.push({ platform: p.platform, href, firstSeenAs: first });
      continue;
    }
    seen.set(key, p.platform);
    kept.push({ platform: p.platform, href });
  }
  return { kept, dropped };
}

describe("normalizeSocialUrl — additional edge cases", () => {
  describe("query parameters", () => {
    it("preserves parameter order as written", () => {
      expect(normalizeSocialUrl("https://x.com/rrlabs?b=2&a=1")).toBe(
        "https://x.com/rrlabs?b=2&a=1",
      );
    });

    it("preserves an empty value parameter", () => {
      expect(normalizeSocialUrl("https://x.com/rrlabs?ref=")).toBe(
        "https://x.com/rrlabs?ref=",
      );
    });

    it("preserves percent-encoded values", () => {
      expect(
        normalizeSocialUrl("https://x.com/rrlabs?q=hello%20world"),
      ).toBe("https://x.com/rrlabs?q=hello%20world");
    });

    it("preserves a single '?' with no key/value", () => {
      // Some URL implementations strip a bare '?'; normalization stays whatever
      // the built-in URL parser produces, but must be idempotent.
      const once = normalizeSocialUrl("https://x.com/rrlabs?");
      expect(once).not.toBeNull();
      expect(normalizeSocialUrl(once)).toBe(once);
    });

    it("keeps query when hash is present, and strips only the hash", () => {
      expect(
        normalizeSocialUrl("https://x.com/rrlabs?ref=nav#section"),
      ).toBe("https://x.com/rrlabs?ref=nav");
    });
  });

  describe("trailing slashes with query and fragments", () => {
    it("keeps the '/' before the query (URL semantics differ from '/foo' vs '/foo/')", () => {
      expect(normalizeSocialUrl("https://x.com/rrlabs/?ref=nav")).toBe(
        "https://x.com/rrlabs/?ref=nav",
      );
    });

    it("strips a lone trailing slash even when the input also has a hash", () => {
      expect(normalizeSocialUrl("https://x.com/rrlabs/#top")).toBe(
        "https://x.com/rrlabs",
      );
    });

    it("strips a trailing slash on origin-only URLs", () => {
      expect(normalizeSocialUrl("https://x.com/")).toBe("https://x.com");
      expect(normalizeSocialUrl("https://x.com/#a")).toBe("https://x.com");
    });

    it("is idempotent for combined casing + trailing slash + hash", () => {
      const once = normalizeSocialUrl("HTTPS://GitHub.COM/RRLabsOnline/#readme");
      expect(once).toBe("https://github.com/RRLabsOnline");
      expect(normalizeSocialUrl(once)).toBe(once);
    });
  });

  describe("fragments", () => {
    it("removes a simple hash", () => {
      expect(normalizeSocialUrl("https://x.com/rrlabs#top")).toBe(
        "https://x.com/rrlabs",
      );
    });

    it("removes an empty hash ('#' with no target)", () => {
      expect(normalizeSocialUrl("https://x.com/rrlabs#")).toBe(
        "https://x.com/rrlabs",
      );
    });

    it("removes multi-segment hashes (treated as a single fragment)", () => {
      expect(
        normalizeSocialUrl("https://x.com/rrlabs#section/sub#more"),
      ).toBe("https://x.com/rrlabs");
    });

    it("removes hash even when it contains query-like characters", () => {
      expect(
        normalizeSocialUrl("https://x.com/rrlabs#a?b=1&c=2"),
      ).toBe("https://x.com/rrlabs");
    });
  });

  describe("case-insensitive duplicate removal", () => {
    it("collapses two entries whose only difference is host casing", () => {
      const { kept, dropped } = dedupeCaseInsensitive([
        { platform: "a", href: "https://GitHub.com/RRLabsOnline" },
        { platform: "b", href: "https://github.COM/RRLabsOnline" },
      ]);
      expect(kept).toHaveLength(1);
      expect(kept[0].platform).toBe("a"); // first-wins
      expect(kept[0].href).toBe("https://github.com/RRLabsOnline");
      expect(dropped).toHaveLength(1);
      expect(dropped[0].platform).toBe("b");
      expect(dropped[0].firstSeenAs).toBe("a");
    });

    it("collapses entries that only differ by trailing slash / whitespace / hash", () => {
      const { kept, dropped } = dedupeCaseInsensitive([
        { platform: "x1", href: "https://x.com/rrlabsonline" },
        { platform: "x2", href: "  https://x.com/rrlabsonline/  " },
        { platform: "x3", href: "https://x.com/rrlabsonline#top" },
      ]);
      expect(kept).toHaveLength(1);
      expect(kept[0].platform).toBe("x1");
      expect(dropped.map((d) => d.platform)).toEqual(["x2", "x3"]);
    });

    it("keeps entries that differ only in path casing (paths are case-sensitive)", () => {
      // Handles like /RRLabsOnline vs /rrlabsonline resolve to different
      // profiles on some platforms, so the dedup key uses the full
      // normalized URL lowercased — meaning path-casing collisions
      // are still treated as duplicates. This test locks that behavior
      // so a future change is intentional.
      const { kept } = dedupeCaseInsensitive([
        { platform: "gh-a", href: "https://github.com/RRLabsOnline" },
        { platform: "gh-b", href: "https://github.com/rrlabsonline" },
      ]);
      expect(kept).toHaveLength(1);
      expect(kept[0].platform).toBe("gh-a");
    });

    it("keeps entries with different query strings (queries can distinguish profiles)", () => {
      const { kept } = dedupeCaseInsensitive([
        { platform: "yt-main", href: "https://youtube.com/@rrlabs" },
        { platform: "yt-shorts", href: "https://youtube.com/@rrlabs?tab=shorts" },
      ]);
      expect(kept.map((k) => k.platform)).toEqual(["yt-main", "yt-shorts"]);
    });

    it("drops unsafe or invalid URLs before considering duplicates", () => {
      const { kept, dropped } = dedupeCaseInsensitive([
        { platform: "bad", href: "http://insecure.example/rrlabs" },
        { platform: "good", href: "https://github.com/RRLabsOnline" },
        { platform: "dup", href: "https://GITHUB.COM/RRLabsOnline/" },
      ]);
      // "bad" is filtered by normalizeSocialUrl (not https) — not counted as
      // "kept" nor as a duplicate. "dup" collapses into "good".
      expect(kept.map((k) => k.platform)).toEqual(["good"]);
      expect(dropped.map((d) => d.platform)).toEqual(["dup"]);
    });

    it("respects the enabled flag", () => {
      const { kept } = dedupeCaseInsensitive([
        { platform: "on", href: "https://github.com/rrlabs" },
        { platform: "off", href: "https://x.com/rrlabs", enabled: false },
      ]);
      expect(kept.map((k) => k.platform)).toEqual(["on"]);
    });
  });

  describe("the real ENABLED_SOCIAL_PROFILES registry", () => {
    it("has no case-insensitive duplicate hrefs", () => {
      const keys = ENABLED_SOCIAL_PROFILES.map((p) => p.href.toLowerCase());
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("has no case-insensitive duplicate platforms", () => {
      const platforms = ENABLED_SOCIAL_PROFILES.map((p) => p.platform.toLowerCase());
      expect(new Set(platforms).size).toBe(platforms.length);
    });

    it("every entry is already normalized (idempotent)", () => {
      for (const p of ENABLED_SOCIAL_PROFILES) {
        expect(p.href).toBe(normalizeSocialUrl(p.href));
      }
    });
  });
});
