/**
 * SSRF guard for user-supplied URLs.
 *
 * Every server-side adapter that fetches a URL the workspace typed in
 * (Shopify store URL, WooCommerce site, custom gateway endpoint, …) must
 * pass it through `assertPublicHttpUrl` first. The guard rejects:
 *   - non-http(s) schemes (file:, gopher:, data:, ftp:, …)
 *   - URL credentials (user:pass@host)
 *   - loopback / private / link-local / cloud-metadata literal addresses
 *   - hostnames that obviously resolve to internal infra ("localhost",
 *     "*.internal", "*.local", ".consul", ".cluster.local")
 *
 * We intentionally do a string/regex check instead of DNS resolution:
 * the Worker runtime cannot resolve DNS from application code, and a
 * literal-IP block plus scheme lock-down covers the realistic attack
 * surface (an attacker can only redirect the fetch by typing the URL —
 * they don't control the DNS records of a hostname they don't own).
 */

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIPv4(host: string): boolean {
  const m = IPV4_RE.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7 unique-local
  if (h.startsWith("fe80")) return true; // link-local
  if (h.startsWith("::ffff:")) {
    // IPv4-mapped
    const v4 = h.slice("::ffff:".length);
    if (IPV4_RE.test(v4)) return isPrivateIPv4(v4);
  }
  return false;
}

const BAD_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
]);

function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (BAD_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost")) return true;
  if (h.endsWith(".local")) return true;
  if (h.endsWith(".internal")) return true;
  if (h.endsWith(".consul")) return true;
  if (h.endsWith(".cluster.local")) return true;
  return false;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Throws `UnsafeUrlError` when `raw` is not a public http(s) URL.
 * Callers should surface the error message to the user as a validation error.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL is not valid.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs are allowed.");
  }
  if (u.username || u.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  }
  const host = u.hostname;
  if (!host) throw new UnsafeUrlError("URL host is missing.");
  if (isPrivateHostname(host) || isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new UnsafeUrlError(
      "URLs pointing to private, loopback, or cloud-metadata addresses are not allowed.",
    );
  }
  return u;
}

/** Convenience: returns `null` when safe, or an error message when not. */
export function checkPublicHttpUrl(raw: string): string | null {
  try {
    assertPublicHttpUrl(raw);
    return null;
  } catch (e) {
    return e instanceof UnsafeUrlError ? e.message : "URL is not allowed.";
  }
}
