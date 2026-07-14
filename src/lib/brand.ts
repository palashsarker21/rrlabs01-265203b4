/**
 * RRLabs brand + company information — single source of truth.
 */
import logoAsset from "../../public/brand/logo.png.asset.json";
import icon32 from "../../public/brand/icon-32.png.asset.json";
import icon180 from "../../public/brand/icon-180.png.asset.json";
import icon192 from "../../public/brand/icon-192.png.asset.json";
import icon512 from "../../public/brand/icon-512.png.asset.json";
import maskable512 from "../../public/brand/maskable-512.png.asset.json";
import ogImage from "../../public/brand/og-image.jpg.asset.json";

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
    line1: "60, Chowhaddi, Dotto Kendua-7901",
    line2: "Madaripur Sadar",
    city: "Madaripur",
    region: "Dhaka",
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
  full: logoAsset.url,
  icon32: icon32.url,
  icon180: icon180.url,
  icon192: icon192.url,
  icon512: icon512.url,
  maskable512: maskable512.url,
  ogImage: ogImage.url,
} as const;

export const absoluteUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
