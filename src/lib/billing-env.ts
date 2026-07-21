/**
 * Loud environment validation for Lemon Squeezy billing.
 *
 * Call `assertBillingEnv()` from a server function or route to fail fast
 * with a precise error listing every missing variable. Never called at
 * module scope — process.env is only reliable inside handlers.
 */

const REQUIRED = [
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_STORE_ID",
  "LEMONSQUEEZY_WEBHOOK_SECRET",
] as const;

const VARIANTS = [
  "LEMONSQUEEZY_VARIANT_STARTER",
  "LEMONSQUEEZY_VARIANT_GROWTH",
  "LEMONSQUEEZY_VARIANT_BUSINESS",
] as const;

/**
 * Optional variant — used ONLY by the Success Fee engine to bill accrued
 * recovered-revenue commissions. If unset, monthly statements are still
 * built (draft/finalized) but cannot be invoiced automatically.
 */
export const SUCCESS_FEE_VARIANT_ENV = "LEMONSQUEEZY_VARIANT_SUCCESS_FEE" as const;

export type BillingEnvReport = {
  ok: boolean;
  missingRequired: string[];
  missingVariants: string[];
  successFeeVariantConfigured: boolean;
};

export function checkBillingEnv(): BillingEnvReport {
  const missingRequired = REQUIRED.filter((k) => !process.env[k]);
  const missingVariants = VARIANTS.filter((k) => !process.env[k]);
  return {
    ok: missingRequired.length === 0 && missingVariants.length === 0,
    missingRequired,
    missingVariants,
    successFeeVariantConfigured: Boolean(process.env[SUCCESS_FEE_VARIANT_ENV]),
  };
}

export function assertBillingEnv(): void {
  const r = checkBillingEnv();
  if (!r.ok) {
    const missing = [...r.missingRequired, ...r.missingVariants];
    throw new Error(`Billing misconfigured. Missing required env vars: ${missing.join(", ")}`);
  }
}
