/**
 * RRLabs Pricing — Single Source of Truth (display).
 *
 * This file drives every pricing surface across the marketing site and app:
 * pricing page, checkout, upgrade, dashboard current-plan card, comparison
 * table, ROI calculator, FAQ. Server-side checkout still resolves the LS
 * variant from the `plans` table (source of truth for billing), but every
 * label, feature bullet, badge, CTA, and success-fee % is defined here.
 *
 * Never hardcode plan copy or checkout URLs in components — import from here.
 */

export const TRIAL_DAYS = 14;

export type PlanCode = "starter" | "growth" | "business" | "enterprise";

export type PlanCta =
  | { kind: "trial"; label: "Start Free 14-Day Trial" }
  | { kind: "contact_sales"; label: "Talk to Sales" };

export type PricingPlan = {
  code: PlanCode;
  name: string;
  tagline: string;
  /** Display price string, e.g. "$29" or "Custom". */
  price: string;
  priceSuffix?: string;
  /** Prefix line above the price, e.g. "Starting at". */
  priceLead?: string;
  /** Marketing string for success fee (e.g. "+3% success fee"). */
  successFee: string;
  /** Basis points; kept for calculators. */
  successFeeBps: number;
  /** Base monthly $ in cents, used by ROI calc. Null for Enterprise. */
  monthlyBaseCents: number | null;
  featuresLead?: string;
  features: string[];
  cta: PlanCta;
  /** Whether this plan is marketed as "MOST POPULAR". */
  highlight?: boolean;
  /** Whether this plan is marketed as "ENTERPRISE". */
  enterprise?: boolean;
  /** Env-var name whose value is the LS variant id (server-side check). */
  lsVariantEnvKey?:
    | "LEMONSQUEEZY_VARIANT_STARTER"
    | "LEMONSQUEEZY_VARIANT_GROWTH"
    | "LEMONSQUEEZY_VARIANT_BUSINESS"
    | "LEMONSQUEEZY_VARIANT_SCALE";
};

export const PLANS: PricingPlan[] = [
  {
    code: "starter",
    name: "Starter",
    tagline: "Best for startups.",
    price: "$29",
    priceSuffix: "/month",
    successFee: "+5% of successfully recovered revenue",
    successFeeBps: 500,
    monthlyBaseCents: 2900,
    features: [
      "AI Recovery Engine",
      "Email Recovery",
      "WhatsApp Recovery",
      "1 Store Connection",
      "Basic Dashboard",
      "Basic Analytics",
      "Community Support",
    ],
    cta: { kind: "trial", label: "Start Free 14-Day Trial" },
    lsVariantEnvKey: "LEMONSQUEEZY_VARIANT_STARTER",
  },
  {
    code: "growth",
    name: "Growth",
    tagline: "For scaling teams that need automation and priority support.",
    price: "$99",
    priceSuffix: "/month",
    successFee: "+4% of successfully recovered revenue",
    successFeeBps: 400,
    monthlyBaseCents: 9900,
    featuresLead: "Everything in Starter, plus",
    features: [
      "Professional Dashboard",
      "Advanced Analytics",
      "Customer Segmentation",
      "AI Recommendations",
      "Workflow Automation",
      "Up to 3 Store Connections",
      "Priority Support",
    ],
    cta: { kind: "trial", label: "Start Free 14-Day Trial" },
    highlight: true,
    lsVariantEnvKey: "LEMONSQUEEZY_VARIANT_GROWTH",
  },
  {
    code: "business",
    name: "Scale",
    tagline: "Built for growing SaaS companies.",
    price: "$299",
    priceSuffix: "/month",
    successFee: "+3% of successfully recovered revenue",
    successFeeBps: 300,
    monthlyBaseCents: 29900,
    featuresLead: "Everything in Growth, plus",
    features: [
      "Multiple Store Connections",
      "Advanced Dashboard",
      "Revenue Intelligence",
      "Predictive Analytics",
      "Enterprise-grade Security",
      "Dedicated Success Manager",
    ],
    cta: { kind: "trial", label: "Start Free 14-Day Trial" },
    lsVariantEnvKey: "LEMONSQUEEZY_VARIANT_BUSINESS",
  },
  {
    code: "enterprise",
    name: "Enterprise",
    tagline: "For enterprises with advanced requirements.",
    price: "Custom",
    priceLead: "Starting at $999/month",
    successFee: "+1–2% of successfully recovered revenue",
    successFeeBps: 200,
    monthlyBaseCents: null,
    features: [
      "White Label",
      "Dedicated Infrastructure",
      "Dedicated AI Environment",
      "Enterprise SLA",
      "Enterprise Services",
      "Dedicated Engineer",
      "Custom Integrations",
      "Unlimited Stores",
      "Custom AI Models",
    ],
    cta: { kind: "contact_sales", label: "Talk to Sales" },
    enterprise: true,
  },
];

export function getPlanByCode(code: string): PricingPlan | undefined {
  return PLANS.find((p) => p.code === code);
}

export function formatSuccessFeeBps(bps: number | null | undefined): string {
  if (bps == null) return "";
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export type CompareValue = boolean | string;

export const COMPARE_ROWS: {
  label: string;
  values: [CompareValue, CompareValue, CompareValue, CompareValue];
}[] = [
  { label: "AI Recovery Engine", values: [true, true, true, true] },
  { label: "Email Recovery", values: [true, true, true, true] },
  { label: "WhatsApp Recovery", values: [true, true, true, true] },
  { label: "Dashboard", values: ["Basic", "Professional", "Advanced", "Custom"] },
  { label: "Analytics", values: ["Basic", "Advanced", "Predictive", "Custom"] },
  { label: "Revenue Intelligence", values: [false, false, true, true] },
  { label: "Predictive Analytics", values: [false, false, true, true] },
  { label: "Workflow Automation", values: [false, true, true, true] },
  { label: "API", values: [true, true, true, true] },
  { label: "Webhooks", values: [true, true, true, true] },
  { label: "White Label", values: [false, false, false, true] },
  {
    label: "Support",
    values: ["Community", "Priority", "Dedicated CSM", "Dedicated Engineer"],
  },
  {
    label: "Communication Channels",
    values: [
      "Email + WhatsApp",
      "Email + WhatsApp",
      "Email + WhatsApp",
      "Email + WhatsApp + Custom",
    ],
  },
  { label: "Store Connections", values: ["1", "Up to 3", "Multiple", "Unlimited"] },
];

export const PRICING_FAQ = [
  {
    q: "What is the success fee?",
    a: "In addition to your monthly plan, RRLabs charges a small percentage of the revenue we successfully recover for you. If we don't recover anything, you don't pay a success fee.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Every plan starts with a 14-day free trial — no credit card required. Add a payment method whenever you're ready to continue.",
  },
  {
    q: "Can I upgrade or downgrade later?",
    a: "Yes. You can change plans any time from your dashboard. Upgrades take effect immediately; downgrades take effect at the next renewal.",
  },
  {
    q: "How does billing work?",
    a: "A fixed monthly (or annual) subscription plus a success fee on recovered revenue. Payments are processed securely via Lemon Squeezy. You'll get a receipt and can cancel any time.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit and at rest. We follow strict row-level access controls, keep detailed audit logs, and never share your data with third parties.",
  },
  {
    q: "Can I cancel any time?",
    a: "Absolutely. Cancel any time from your dashboard — no forms, no phone calls. You retain access through the end of your billing period.",
  },
];

export const TRUST_BADGES = [
  "14-Day Free Trial",
  "No Credit Card Required",
  "Cancel Anytime",
  "AI Powered",
  "Enterprise Ready",
];
