import { describe, expect, it } from "vitest";
import { normalizeSocialUrl } from "@/lib/brand";

describe("normalizeSocialUrl — edge cases", () => {
  describe("mixed casing", () => {
    it("lowercases the host regardless of casing", () => {
      expect(normalizeSocialUrl("https://GITHUB.COM/RRLabsOnline")).toBe(
        "https://github.com/RRLabsOnline",
      );
      expect(normalizeSocialUrl("https://GitHub.Com/RRLabsOnline")).toBe(
        "https://github.com/RRLabsOnline",
      );
      expect(normalizeSocialUrl("https://gItHuB.cOm/RRLabsOnline")).toBe(
        "https://github.com/RRLabsOnline",
      );
    });

    it("lowercases the scheme via URL parsing", () => {
      expect(normalizeSocialUrl("HTTPS://github.com/RRLabsOnline")).toBe(
        "https://github.com/RRLabsOnline",
      );
    });

    it("preserves path casing (handles are case-sensitive on some platforms)", () => {
      expect(normalizeSocialUrl("https://github.com/RRLabsOnline")).toBe(
        "https://github.com/RRLabsOnline",
      );
      expect(normalizeSocialUrl("https://github.com/rrlabsonline")).toBe(
        "https://github.com/rrlabsonline",
      );
    });
  });

  describe("query parameters", () => {
    it("retains a single query parameter", () => {
      expect(normalizeSocialUrl("https://x.com/rrlabsonline?ref=site")).toBe(
        "https://x.com/rrlabsonline?ref=site",
      );
    });

    it("retains multiple query parameters in original order", () => {
      expect(
        normalizeSocialUrl("https://x.com/rrlabsonline?utm_source=nav&utm_medium=footer"),
      ).toBe("https://x.com/rrlabsonline?utm_source=nav&utm_medium=footer");
    });

    it("normalizes host casing while keeping the query intact", () => {
      expect(
        normalizeSocialUrl("https://X.COM/rrlabsonline?utm_source=NAV"),
      ).toBe("https://x.com/rrlabsonline?utm_source=NAV");
    });

    it("strips the hash but keeps the query", () => {
      expect(
        normalizeSocialUrl("https://x.com/rrlabsonline?ref=site#top"),
      ).toBe("https://x.com/rrlabsonline?ref=site");
    });
  });

  describe("trailing slashes", () => {
    it("removes a lone trailing slash from the origin", () => {
      expect(normalizeSocialUrl("https://github.com/")).toBe("https://github.com");
    });

    it("removes a trailing slash from a path segment", () => {
      expect(normalizeSocialUrl("https://github.com/RRLabsOnline/")).toBe(
        "https://github.com/RRLabsOnline",
      );
    });

    it("is idempotent when no trailing slash exists", () => {
      const url = "https://github.com/RRLabsOnline";
      expect(normalizeSocialUrl(url)).toBe(url);
    });

    it("does not add a trailing slash before a query", () => {
      expect(normalizeSocialUrl("https://github.com/RRLabsOnline/?tab=repositories")).toBe(
        "https://github.com/RRLabsOnline/?tab=repositories",
      );
    });
  });

  describe("whitespace handling", () => {
    it("trims leading and trailing spaces", () => {
      expect(normalizeSocialUrl("   https://github.com/RRLabsOnline   ")).toBe(
        "https://github.com/RRLabsOnline",
      );
    });

    it("trims tabs and newlines", () => {
      expect(normalizeSocialUrl("\t\nhttps://github.com/RRLabsOnline\n\t")).toBe(
        "https://github.com/RRLabsOnline",
      );
    });

    it("returns null for whitespace-only input", () => {
      expect(normalizeSocialUrl("   ")).toBeNull();
      expect(normalizeSocialUrl("\n\t")).toBeNull();
      expect(normalizeSocialUrl("")).toBeNull();
    });
  });

  describe("idempotency across combined transformations", () => {
    const inputs = [
      "  HTTPS://GitHub.COM/RRLabsOnline/  ",
      "https://X.COM/rrlabsonline/?ref=site#hash",
      "https://LinkedIn.com/company/rrlabs/",
      "\thttps://YouTube.com/@rrlabs/\n",
    ];

    for (const input of inputs) {
      it(`normalizes ${JSON.stringify(input)} deterministically`, () => {
        const once = normalizeSocialUrl(input);
        const twice = normalizeSocialUrl(once);
        expect(once).not.toBeNull();
        expect(twice).toBe(once);
        // No trailing slash left after normalization
        expect(once!.endsWith("/")).toBe(false);
        // No hash
        expect(once!.includes("#")).toBe(false);
        // https scheme
        expect(once!.startsWith("https://")).toBe(true);
      });
    }
  });
});
