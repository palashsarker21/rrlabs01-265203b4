/**
 * Client-side CTA routing for pricing/checkout flows.
 *
 * `resolveCta` is a pure function that decides, based on the user's session
 * state and the plan configuration, what the primary CTA on a pricing card
 * should do. It does NOT hit the network. Callers handle navigation.
 *
 * The corresponding server-side gatekeeper is `createCheckoutSession` in
 * `src/lib/billing.functions.ts`, which rejects Enterprise and resolves a
 * Lemon Squeezy checkout variant for every self-serve plan.
 */

import type { PricingPlan } from "./pricing";

export type CtaKind =
  | "signup" // not signed in — send to /auth then to /checkout
  | "checkout" // signed in, no active sub — send to /checkout
  | "manage" // already has an active sub for this or higher plan
  | "contact_sales"; // enterprise / talk-to-sales

export type CtaState = {
  kind: CtaKind;
  label: string;
  href: string;
  disabled?: boolean;
};

export type CtaContext = {
  plan: PricingPlan;
  /** Kept for backwards compat; no longer affects the CTA. Every self-serve
   * plan is purchasable — checkout falls back to the plan id when a
   * per-variant checkout is not configured. */
  hasCheckoutVariant?: boolean;
  isAuthenticated: boolean;
  /** Currently subscribed plan code, if any. */
  currentPlanCode?: string | null;
  /** DB plan id (uuid) — passed to /checkout so the server fn can resolve. */
  planIdForCheckout?: string | null;
};

export function resolveCta({
  plan,
  isAuthenticated,
  currentPlanCode,
  planIdForCheckout,
}: CtaContext): CtaState {
  // Enterprise always → Contact Sales.
  if (plan.cta.kind === "contact_sales" || plan.enterprise) {
    return {
      kind: "contact_sales",
      label: plan.cta.label,
      href: `/contact-sales?plan=${plan.code}`,
    };
  }

  if (currentPlanCode === plan.code) {
    return {
      kind: "manage",
      label: "Current Plan",
      href: "/app?tab=billing",
      disabled: false,
    };
  }

  if (!isAuthenticated) {
    return {
      kind: "signup",
      label: plan.cta.label,
      href: `/auth?redirect=${encodeURIComponent(`/checkout${planIdForCheckout ? `?plan=${planIdForCheckout}` : ""}`)}`,
    };
  }

  return {
    kind: "checkout",
    label: plan.cta.label,
    href: planIdForCheckout ? `/checkout?plan=${planIdForCheckout}` : "/checkout",
  };
}
