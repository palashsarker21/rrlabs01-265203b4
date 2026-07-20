/**
 * RRLabs brand + company information — single source of truth.
 *
 * Brand images are served as static files from /public/brand/* so they work
 * on every deploy target (Vercel, Cloudflare, Lovable). Do NOT switch these
 * back to *.asset.json pointers — those resolve to /__l5e/assets-v1/* which
 * only exists on Lovable-hosted domains and 404s on Vercel.
 */

export const BRAND = {
  company: "Revenue Recovery Labs",
  name: "RRLabs",
  short: "RRLabs",
  tagline:
    "Enterprise AI platform for revenue recovery, subscription retention, and predictable growth.",
  description:
    "RRLabs builds the enterprise AI platform for revenue recovery, subscription retention, and predictable growth.",
  legalOwner: "Revenue Recovery Labs (RRLabs)",
} as const;

export const SITE_URL = "https://www.rrlabs.online";

export const CONTACT = {
  supportEmail: "support@rrlabs.online",
  founderEmail: "founder@rrlabs.online",
  businessEmail: "founder@rrlabs.online",
  phones: ["+8801323405346", "+8801934857886", "+8801557749217"] as const,
  whatsappBusinessNumber: "+8801557749217",
  address: {
    line1: "60, Chowhaddi, Dotto Kendua",
    line2: "Madaripur Sadar",
    city: "Madaripur",
    region: "Dhaka",
    postalCode: "7901",
    country: "Bangladesh",
  },
  website: SITE_URL,
} as const;

export type PhoneKind = "primary" | "secondary" | "whatsapp";
export interface PhoneEntry {
  number: string;
  label: string;
  kind: PhoneKind;
  ariaLabel: string;
}

export const CONTACT_PHONES: readonly PhoneEntry[] = [
  {
    number: "+8801323405346",
    label: "Primary",
    kind: "primary",
    ariaLabel: "Call +8801323405346",
  },
  {
    number: "+8801934857886",
    label: "Secondary",
    kind: "secondary",
    ariaLabel: "Call +8801934857886",
  },
  {
    number: "+8801557749217",
    label: "WhatsApp Business",
    kind: "whatsapp",
    ariaLabel: "Message WhatsApp Business +8801557749217",
  },
];


export const SOCIAL = {
  facebook: "https://www.facebook.com/rrlabsonline",
  linkedin: "https://www.linkedin.com/company/rrlabsonline",
  x: "https://x.com/rrlabsonline",
  instagram: "https://www.instagram.com/rrlabsonline",
  threads: "https://www.threads.com/@rrlabsonline",
  youtube: "https://www.youtube.com/@rrlabsonline",
  github: "https://github.com/RRLabsOnline",
} as const;

/**
 * Ordered, enable-flagged registry of official social profiles. The
 * `SocialLinks` component renders every entry with `enabled: true`. Reserved
 * platforms stay `enabled: false` so they can be turned on later by config
 * only, with no code changes elsewhere.
 */
export type SocialPlatform =
  | "github"
  | "linkedin"
  | "x"
  | "facebook"
  | "instagram"
  | "threads"
  | "youtube"
  | "producthunt"
  | "crunchbase"
  | "g2"
  | "capterra"
  | "devto"
  | "hashnode"
  | "medium";

export interface SocialProfile {
  platform: SocialPlatform;
  label: string;
  href: string;
  enabled: boolean;
}

export const SOCIAL_PROFILES: readonly SocialProfile[] = [
  { platform: "github", label: "GitHub", href: SOCIAL.github, enabled: true },
  { platform: "linkedin", label: "LinkedIn", href: SOCIAL.linkedin, enabled: true },
  { platform: "x", label: "X (Twitter)", href: SOCIAL.x, enabled: true },
  { platform: "facebook", label: "Facebook", href: SOCIAL.facebook, enabled: true },
  { platform: "instagram", label: "Instagram", href: SOCIAL.instagram, enabled: true },
  { platform: "threads", label: "Threads", href: SOCIAL.threads, enabled: true },
  { platform: "youtube", label: "YouTube", href: SOCIAL.youtube, enabled: true },
  // Reserved — flip `enabled: true` and set `href` once the profile exists.
  { platform: "producthunt", label: "Product Hunt", href: "", enabled: false },
  { platform: "crunchbase", label: "Crunchbase", href: "", enabled: false },
  { platform: "g2", label: "G2", href: "", enabled: false },
  { platform: "capterra", label: "Capterra", href: "", enabled: false },
  { platform: "devto", label: "Dev.to", href: "", enabled: false },
  { platform: "hashnode", label: "Hashnode", href: "", enabled: false },
  { platform: "medium", label: "Medium", href: "", enabled: false },
];

/**
 * Normalize a social profile URL. Returns `null` for anything that is not a
 * safe, absolute `https://` URL. Trims whitespace, lowercases the host, and
 * removes a lone trailing slash so equivalent URLs compare equal.
 */
export function normalizeSocialUrl(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname === "/") url.pathname = "";
  // Drop hash; keep query in case a profile ever needs one.
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

/**
 * Enabled social profiles, filtered to safe URLs and deduplicated. This is
 * the single sanitized list that both `SocialLinks` and JSON-LD consume.
 */
export const ENABLED_SOCIAL_PROFILES: readonly SocialProfile[] = (() => {
  const seen = new Map<string, string>(); // normalized href -> first platform
  const out: SocialProfile[] = [];
  const invalid: Array<{ platform: string; href: string }> = [];
  const duplicates: Array<{ platform: string; href: string; firstSeenAs: string }> = [];

  for (const p of SOCIAL_PROFILES) {
    if (!p.enabled) continue;
    const href = normalizeSocialUrl(p.href);
    if (!href) {
      invalid.push({ platform: p.platform, href: p.href });
      continue;
    }
    const key = href.toLowerCase();
    const firstSeenAs = seen.get(key);
    if (firstSeenAs !== undefined) {
      duplicates.push({ platform: p.platform, href, firstSeenAs });
      continue;
    }
    seen.set(key, p.platform);
    out.push({ ...p, href });
  }

  // Dev-only diagnostics. Guarded so this never runs in production bundles.
  // `import.meta.env.DEV` is inlined to `false` by Vite at build time, so the
  // whole block is dead-code-eliminated in production.
  if (import.meta.env.DEV && (invalid.length > 0 || duplicates.length > 0)) {
    if (invalid.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[brand] SOCIAL_PROFILES contains ${invalid.length} invalid URL(s). ` +
          `These profiles are enabled but their href is not a safe absolute https:// URL and will be dropped:`,
        invalid,
      );
    }
    if (duplicates.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[brand] SOCIAL_PROFILES contains ${duplicates.length} duplicate URL(s). ` +
          `These profiles normalize to a URL already registered by another platform and will be dropped:`,
        duplicates,
      );
    }
  }

  return out;
})();

/** URLs of every publicly listed, enabled profile — used in JSON-LD `sameAs`. */
export const SOCIAL_SAME_AS: readonly string[] = ENABLED_SOCIAL_PROFILES.map(
  (p) => p.href,
);

export const LOGO = {
  full: "/brand/logo.png",
  icon32: "/brand/icon-32.png",
  icon180: "/brand/icon-180.png",
  icon192: "/brand/icon-192.png",
  icon512: "/brand/icon-512.png",
  maskable512: "/brand/maskable-512.png",
  ogImage: "/brand/og-image.jpg",
} as const;

export const absoluteUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
