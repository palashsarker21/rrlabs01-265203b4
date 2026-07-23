/**
 * RRLabs Pricing — Type & helper module.
 *
 * As of Wave 2 (Pricing SSOT), all pricing DATA lives in the database:
 *   - `public.plans`         → per-plan display + billing fields
 *   - `public.site_content`  → cross-plan marketing content (trial days,
 *                              trust badges, comparison matrix, FAQ)
 *
 * Load runtime values via the server functions in `pricing.functions.ts`
 * (`listPublicPlans`, `getPricingContent`). This file only exports the
 * shared TypeScript types and formatting helpers used by consumers.
 *
 * `TRIAL_DAYS_FALLBACK` is retained solely for static route `head()` meta
 * strings that must render synchronously during SSR; runtime UI must read
 * the trial length from `getPricingContent()`.
 */

export const TRIAL_DAYS_FALLBACK = 14;

export type PlanCode = "starter" | "growth" | "business" | "enterprise" | string;

export type CtaKind = "trial" | "contact_sales";

/** Client-facing plan shape returned by `listPublicPlans`. */
export type PricingPlan = {
  id: string;
  code: PlanCode;
  name: string;
  tagline: string | null;
  description: string | null;
  /** Marketing display price string, e.g. "$29" or "Custom". */
  priceDisplay: string;
  priceSuffix: string | null;
  /** Prefix line above the price, e.g. "Starting at $999/month". */
  priceLead: string | null;
  /** Basis points; used by ROI calc + display. */
  successFeeBps: number | null;
  /** Marketing string for success fee (e.g. "+3% success fee"). */
  successFeeLabel: string | null;
  /** Base monthly USD in cents; null for Custom/Enterprise. */
  monthlyBaseCents: number | null;
  featuresLead: string | null;
  features: string[];
  ctaKind: CtaKind;
  ctaLabel: string;
  highlight: boolean;
  /** Marketed as the enterprise / talk-to-sales tier. */
  isMarketedEnterprise: boolean;
  /** Backing billing behaviour — no self-serve checkout. */
  isContactSales: boolean;
  trialDays: number;
  currency: string;
  interval: string;
  startingAtPriceCents: number | null;
  sortOrder: number;
  /** True when a Lemon Squeezy variant is resolvable for this plan. */
  hasVariant: boolean;
};

export type CompareCellValue = boolean | string;

export type CompareRow = {
  label: string;
  values: CompareCellValue[];
};

export type FaqItem = { q: string; a: string };

export type PricingContent = {
  trialDays: number;
  trustBadges: string[];
  compareRows: CompareRow[];
  faq: FaqItem[];
};

export function formatSuccessFeeBps(bps: number | null | undefined): string {
  if (bps == null) return "";
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** Helper for callers that already have the full plan list in hand. */
export function findPlanByCode(
  plans: PricingPlan[] | null | undefined,
  code: string,
): PricingPlan | undefined {
  return (plans ?? []).find((p) => p.code === code);
}
