import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalizeSocialUrl } from "@/lib/brand";

/**
 * Mirrors the SOCIAL_SAME_AS builder in `src/lib/brand.ts`:
 *
 *   SOCIAL_PROFILES
 *     .filter(p => p.enabled)
 *     .map(p => normalizeSocialUrl(p.href))
 *     .filter(Boolean)
 *     .dedupeBy(v => v.toLowerCase(), first-wins)
 *
 * We test the algorithm itself against arbitrary inputs. If either the
 * shape of this helper or the shape of the real builder changes, both must
 * change together.
 */
function buildSameAs(profiles: ReadonlyArray<{ href: unknown; enabled?: boolean }>): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const p of profiles) {
    if (p.enabled === false) continue;
    const href = normalizeSocialUrl(p.href as string | undefined | null);
    if (!href) continue;
    const key = href.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, href);
    out.push(href);
  }
  return out;
}

const HTTPS_ABSOLUTE = /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s]*)?$/;

// ---------- Arbitraries -------------------------------------------------------

/** A well-formed https:// URL suitable as a valid social profile href. */
const validHttpsUrl = fc
  .record({
    subdomain: fc.constantFrom("www.", "", "m.", "app."),
    domain: fc.stringMatching(/^[a-z][a-z0-9-]{1,20}$/),
    tld: fc.constantFrom("com", "io", "co", "net", "dev", "app"),
    path: fc.constantFrom("", "/rrlabs", "/@rrlabs", "/company/rrlabs", "/RRLabsOnline"),
    // Random surface variations — normalizer must collapse them.
    trailingSlash: fc.boolean(),
    hostCase: fc.boolean(),
    hash: fc.constantFrom("", "#top", "#a/b"),
    padding: fc.constantFrom("", " ", "\t"),
  })
  .map(({ subdomain, domain, tld, path, trailingSlash, hostCase, hash, padding }) => {
    const host = `${subdomain}${domain}.${tld}`;
    const hostFinal = hostCase ? host.toUpperCase() : host;
    const suffix = trailingSlash && path !== "" ? "/" : "";
    return `${padding}https://${hostFinal}${path}${suffix}${hash}${padding}`;
  });

/** Malformed / unsafe inputs — every one MUST be rejected. */
const malformedInput = fc.oneof(
  // Wrong / dangerous schemes.
  fc.constantFrom(
    "http://example.com/rrlabs",
    "ftp://example.com/rrlabs",
    "javascript:alert(1)",
    "javascript:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "mailto:hi@example.com",
    "tel:+15551234567",
    "//example.com/rrlabs",
    "example.com/rrlabs",
    "/rrlabs",
    "rrlabs",
    "",
    "   ",
    "\n\t",
    "https://",
    // Note: "https:///path" is intentionally omitted — WHATWG URL parsing
    // treats it as https://path/ (hostname "path"), which the normalizer
    // legitimately accepts as an absolute https URL.
    "not a url",
  ),
  // Random non-string values (the function accepts unknown-ish input).
  fc.constantFrom(null, undefined, 0, 1, true, false, {}, [], Number.NaN) as fc.Arbitrary<unknown>,
  // Random garbage strings.
  fc.string({ minLength: 0, maxLength: 40 }),
);

// ---------- Properties --------------------------------------------------------

describe("SOCIAL_SAME_AS builder — property-based fuzz", () => {
  it("every output is an absolute https:// URL with no trailing slash or fragment", () => {
    fc.assert(
      fc.property(fc.array(validHttpsUrl, { maxLength: 20 }), (hrefs) => {
        const out = buildSameAs(hrefs.map((href) => ({ href, enabled: true })));
        for (const url of out) {
          expect(url.startsWith("https://")).toBe(true);
          expect(url.endsWith("/")).toBe(false);
          expect(url.includes("#")).toBe(false);
          expect(url).toMatch(HTTPS_ABSOLUTE);
          // Host component must be fully lowercased.
          const { host } = new URL(url);
          expect(host).toBe(host.toLowerCase());
        }
      }),
      { numRuns: 200 },
    );
  });

  it("output has no case-insensitive duplicates", () => {
    fc.assert(
      fc.property(fc.array(validHttpsUrl, { maxLength: 30 }), (hrefs) => {
        const out = buildSameAs(hrefs.map((href) => ({ href, enabled: true })));
        const keys = out.map((u) => u.toLowerCase());
        expect(new Set(keys).size).toBe(keys.length);
      }),
      { numRuns: 200 },
    );
  });

  it("malformed inputs are always dropped, never appear in the output", () => {
    fc.assert(
      fc.property(fc.array(malformedInput, { maxLength: 30 }), (bad) => {
        const out = buildSameAs(bad.map((href) => ({ href, enabled: true })));
        expect(out).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });

  it("malformed inputs mixed with valid ones only keep the valid ones", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(validHttpsUrl, malformedInput), { maxLength: 40 }), (mixed) => {
        const out = buildSameAs(mixed.map((href) => ({ href, enabled: true })));
        for (const url of out) {
          expect(url).toMatch(HTTPS_ABSOLUTE);
          // Every survivor is equal to its own normalization (idempotent).
          expect(url).toBe(normalizeSocialUrl(url));
        }
      }),
      { numRuns: 200 },
    );
  });

  it("entries with enabled === false never appear in the output", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ href: validHttpsUrl, enabled: fc.boolean() }), { maxLength: 30 }),
        (entries) => {
          const disabledNormalized = new Set(
            entries
              .filter((e) => e.enabled === false)
              .map((e) => normalizeSocialUrl(e.href))
              .filter((v): v is string => v !== null),
          );
          const out = buildSameAs(entries);
          // Any disabled URL that also appears as an enabled entry is fine —
          // it survives via the enabled entry. But no output URL may come
          // ONLY from disabled entries.
          const enabledNormalized = new Set(
            entries
              .filter((e) => e.enabled !== false)
              .map((e) => normalizeSocialUrl(e.href))
              .filter((v): v is string => v !== null),
          );
          for (const url of out) {
            expect(enabledNormalized.has(url)).toBe(true);
          }
          // Sanity: an output-only-disabled URL cannot exist.
          for (const url of out) {
            if (!enabledNormalized.has(url)) {
              expect(disabledNormalized.has(url)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("is idempotent: rebuilding from the output yields the same output", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(validHttpsUrl, malformedInput), { maxLength: 30 }), (mixed) => {
        const first = buildSameAs(mixed.map((href) => ({ href, enabled: true })));
        const second = buildSameAs(first.map((href) => ({ href, enabled: true })));
        expect(second).toEqual(first);
      }),
      { numRuns: 150 },
    );
  });

  it("first-wins ordering: prepending a duplicate does not reorder existing entries", () => {
    fc.assert(
      fc.property(
        fc.array(validHttpsUrl, { minLength: 1, maxLength: 15 }),
        validHttpsUrl,
        (hrefs, extra) => {
          const base = buildSameAs(hrefs.map((href) => ({ href, enabled: true })));
          const withExtra = buildSameAs([...hrefs, extra].map((href) => ({ href, enabled: true })));
          // Existing entries must appear in the same order at the front.
          expect(withExtra.slice(0, base.length)).toEqual(base);
          // The output is still deduped.
          expect(new Set(withExtra.map((u) => u.toLowerCase())).size).toBe(withExtra.length);
        },
      ),
      { numRuns: 150 },
    );
  });
});
