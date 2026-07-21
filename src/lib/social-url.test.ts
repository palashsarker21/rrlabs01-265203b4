import { describe, it, expect } from "vitest";
import {
  ENABLED_SOCIAL_PROFILES,
  SOCIAL_PROFILES,
  SOCIAL_SAME_AS,
  normalizeSocialUrl,
} from "@/lib/brand";

describe("normalizeSocialUrl", () => {
  it("accepts and canonicalizes a valid https URL", () => {
    expect(normalizeSocialUrl("https://github.com/RRLabsOnline")).toBe(
      "https://github.com/RRLabsOnline",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSocialUrl("  https://x.com/rrlabsonline  ")).toBe("https://x.com/rrlabsonline");
  });

  it("lowercases the host but preserves path casing", () => {
    expect(normalizeSocialUrl("https://GitHub.COM/RRLabsOnline")).toBe(
      "https://github.com/RRLabsOnline",
    );
  });

  it("strips a lone trailing slash", () => {
    expect(normalizeSocialUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeSocialUrl("https://example.com/foo/")).toBe("https://example.com/foo");
  });

  it("drops the URL fragment", () => {
    expect(normalizeSocialUrl("https://example.com/foo#bar")).toBe("https://example.com/foo");
  });

  it.each([
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["not a url", "free text"],
    ["ftp://example.com", "unsupported scheme"],
    ["http://example.com", "insecure http"],
    ["javascript:alert(1)", "javascript scheme"],
    ["data:text/plain,hi", "data scheme"],
    ["mailto:a@b.com", "mailto scheme"],
    ["//example.com", "protocol-relative"],
    ["/relative/path", "relative path"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeSocialUrl(input)).toBeNull();
  });

  it.each([undefined, null, 123 as unknown as string, {} as unknown as string])(
    "rejects non-string input safely",
    (input) => {
      expect(normalizeSocialUrl(input as string | null | undefined)).toBeNull();
    },
  );
});

describe("ENABLED_SOCIAL_PROFILES sanitization", () => {
  it("only contains enabled profiles from the registry", () => {
    const enabledPlatforms = SOCIAL_PROFILES.filter((p) => p.enabled).map((p) => p.platform);
    for (const p of ENABLED_SOCIAL_PROFILES) {
      expect(enabledPlatforms).toContain(p.platform);
    }
  });

  it("only contains normalized safe https URLs", () => {
    for (const p of ENABLED_SOCIAL_PROFILES) {
      expect(p.href).toBe(normalizeSocialUrl(p.href));
      expect(p.href.startsWith("https://")).toBe(true);
    }
  });

  it("has no duplicate URLs (case-insensitive)", () => {
    const keys = ENABLED_SOCIAL_PROFILES.map((p) => p.href.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("SOCIAL_SAME_AS mirrors the sanitized enabled URLs in order", () => {
    expect([...SOCIAL_SAME_AS]).toEqual(ENABLED_SOCIAL_PROFILES.map((p) => p.href));
  });

  it("would filter out malformed and duplicate entries if present", () => {
    // Simulate the sanitization pipeline against a hostile input set to prove
    // the filter behavior (independent of the real registry contents).
    const hostile = [
      {
        platform: "github",
        label: "GitHub",
        href: "https://github.com/RRLabsOnline",
        enabled: true,
      },
      {
        platform: "github",
        label: "GitHub dup",
        href: "https://GITHUB.com/RRLabsOnline/",
        enabled: true,
      },
      { platform: "x", label: "X insecure", href: "http://x.com/rrlabsonline", enabled: true },
      { platform: "x", label: "X bad", href: "javascript:alert(1)", enabled: true },
      { platform: "x", label: "X blank", href: "", enabled: true },
      { platform: "x", label: "X disabled", href: "https://x.com/rrlabsonline", enabled: false },
    ];
    const seen = new Set<string>();
    const kept = hostile
      .filter((p) => p.enabled)
      .map((p) => ({ ...p, href: normalizeSocialUrl(p.href) }))
      .filter((p): p is typeof p & { href: string } => Boolean(p.href))
      .filter((p) => {
        const k = p.href.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    expect(kept.map((k) => k.href)).toEqual(["https://github.com/RRLabsOnline"]);
  });
});
