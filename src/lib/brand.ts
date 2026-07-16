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
  phones: ["+8801323405346", "+8801934857886"] as const,
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

export const SOCIAL = {
  linkedin: "https://www.linkedin.com/company/rrlabs",
  x: "https://x.com/rrlabs",
  github: "https://github.com/rrlabs",
} as const;

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
