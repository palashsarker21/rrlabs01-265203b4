import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalizeSocialUrl } from "@/lib/brand";

/**
 * Property-based / fuzz tests for `normalizeSocialUrl`.
 *
 * Invariants under test:
 *   1. Idempotence — normalize(normalize(x)) === normalize(x)
 *   2. Safety — every non-null result is an absolute https URL with no
 *      trailing slash and a lowercase host.
 *   3. Rejection — anything that is not a plausible https URL returns null.
 *   4. Whitespace/case tolerance — surrounding whitespace and host casing
 *      never change the normalized output.
 *   5. Dedupe key — equivalent inputs normalize to the same string, so a
 *      Set<string> deduplicates them reliably.
 */

const NUM_RUNS = 500;

// Arbitrary that generates plausible, well-formed https URLs.
const validHttpsUrl = fc
  .tuple(
    fc.constantFrom("https"),
    fc.domain(),
    fc.array(
      fc.stringMatching(/^[a-zA-Z0-9._~-]{1,20}$/),
      { minLength: 0, maxLength: 4 },
    ),
    fc.boolean(), // trailing slash
  )
  .map(([proto, host, segments, trailing]) => {
    const path = segments.length ? "/" + segments.join("/") : "";
    return `${proto}://${host}${path}${trailing ? "/" : ""}`;
  });

// Arbitrary garbage: control chars, junk protocols, empty strings, etc.
const malformedInput = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.constant("not a url"),
  fc.constant("://missing-protocol"),
  fc.constant("//no-scheme.example"),
  fc.string().filter((s) => !/^https?:\/\//i.test(s)),
  fc.webUrl({ validSchemes: ["http", "ftp", "ws", "javascript"] }),
  fc.constantFrom(
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "http://example.com",
    "HTTP://example.com/foo",
    "ftp://example.com/foo",
  ),
);

describe("normalizeSocialUrl (fuzz)", () => {
  it("is idempotent for arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const once = normalizeSocialUrl(raw);
        const twice = normalizeSocialUrl(once);
        expect(twice).toBe(once);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns a safe, canonical shape for every non-null result", () => {
    fc.assert(
      fc.property(fc.oneof(validHttpsUrl, fc.string(), malformedInput), (raw) => {
        const out = normalizeSocialUrl(raw);
        if (out === null) return;
        expect(out.startsWith("https://")).toBe(true);
        // No trailing slash (except the mandatory one in the scheme).
        expect(out.slice("https://".length).endsWith("/")).toBe(false);
        // No hash fragment survives.
        expect(out.includes("#")).toBe(false);
        // Parseable and host is already lowercase.
        const parsed = new URL(out);
        expect(parsed.protocol).toBe("https:");
        expect(parsed.hostname).toBe(parsed.hostname.toLowerCase());
        expect(parsed.hash).toBe("");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects non-string inputs", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.double(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.object(),
          fc.array(fc.anything()),
        ),
        (bogus) => {
          expect(
            normalizeSocialUrl(bogus as unknown as string | null | undefined),
          ).toBeNull();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects non-https schemes", () => {
    fc.assert(
      fc.property(
        fc.webUrl({ validSchemes: ["http", "ftp"] }),
        (nonHttps) => {
          expect(normalizeSocialUrl(nonHttps)).toBeNull();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects dangerous / non-URL strings", () => {
    const dangerous = [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "",
      "   ",
      "not a url",
      "//example.com/foo",
      "example.com/foo",
    ];
    for (const input of dangerous) {
      expect(normalizeSocialUrl(input)).toBeNull();
    }
  });

  it("accepts plausible https URLs and normalizes them", () => {
    fc.assert(
      fc.property(validHttpsUrl, (url) => {
        const out = normalizeSocialUrl(url);
        expect(out).not.toBeNull();
        expect(out!.startsWith("https://")).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("is invariant under surrounding whitespace", () => {
    fc.assert(
      fc.property(
        validHttpsUrl,
        fc.stringMatching(/^[ \t\n\r]*$/),
        fc.stringMatching(/^[ \t\n\r]*$/),
        (url, lead, trail) => {
          expect(normalizeSocialUrl(lead + url + trail)).toBe(
            normalizeSocialUrl(url),
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("is invariant under host casing", () => {
    fc.assert(
      fc.property(validHttpsUrl, (url) => {
        const parsed = new URL(url);
        const mixed = url.replace(
          parsed.hostname,
          parsed.hostname
            .split("")
            .map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase()))
            .join(""),
        );
        expect(normalizeSocialUrl(mixed)).toBe(normalizeSocialUrl(url));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("dedupes equivalent inputs via a Set of normalized strings", () => {
    fc.assert(
      fc.property(
        fc.array(validHttpsUrl, { minLength: 1, maxLength: 25 }),
        (urls) => {
          // Build noisy duplicates: whitespace + trailing slash + host casing.
          const noisy = urls.flatMap((u) => {
            const parsed = new URL(u);
            const upperHost = u.replace(
              parsed.hostname,
              parsed.hostname.toUpperCase(),
            );
            return [
              u,
              `  ${u}  `,
              u.endsWith("/") ? u.slice(0, -1) : u + "/",
              upperHost,
              `${u}#fragment`,
            ];
          });

          const canonical = urls
            .map(normalizeSocialUrl)
            .filter((x): x is string => x !== null);
          const canonicalSet = new Set(canonical);

          const dedupedFromNoise = new Set(
            noisy
              .map(normalizeSocialUrl)
              .filter((x): x is string => x !== null),
          );

          expect(dedupedFromNoise).toEqual(canonicalSet);
          // Size is bounded by the number of *distinct* canonical URLs, not
          // by how many noisy variants we fed in.
          expect(dedupedFromNoise.size).toBeLessThanOrEqual(urls.length);
          expect(dedupedFromNoise.size).toBe(canonicalSet.size);
        },
      ),
      { numRuns: 200 },
    );
  });
});
