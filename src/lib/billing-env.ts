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

export type BillingEnvReport = {
  ok: boolean;
  missingRequired: string[];
  missingVariants: string[];
};

export function checkBillingEnv(): BillingEnvReport {
  const missingRequired = REQUIRED.filter((k) => !process.env[k]);
  const missingVariants = VARIANTS.filter((k) => !process.env[k]);
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingVariants,
  };
}

export function assertBillingEnv(): void {
  const r = checkBillingEnv();
  if (!r.ok) {
    throw new Error(
      `Billing misconfigured. Missing required env vars: ${r.missingRequired.join(", ")}`,
    );
  }
}
