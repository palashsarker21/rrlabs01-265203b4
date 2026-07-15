import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, TRIAL_DAYS, type PricingPlan } from "@/lib/pricing";

export type AdminPricingRow = {
  plan: PricingPlan;
  lsVariantConfigured: boolean;
  lsVariantEnvKey: string | null;
  dbPlan: {
    id: string;
    code: string;
    name: string;
    price_cents: number;
    success_fee_bps: number | null;
    ls_variant_id: string | null;
    ls_product_id: string | null;
    is_active: boolean;
    trial_days: number;
  } | null;
};

export type AdminPricingSnapshot = {
  trialDays: number;
  rows: AdminPricingRow[];
  storeId: string | null;
  webhookSecretConfigured: boolean;
};

async function assertSuperAdmin(
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  },
  userId: string,
) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

/** Read-only pricing configuration snapshot for the admin console. */
export const getAdminPricingSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPricingSnapshot> => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);

    const { data: dbPlans, error } = await supabase
      .from("plans")
      .select(
        "id, code, name, price_cents, success_fee_bps, ls_variant_id, ls_product_id, is_active, trial_days",
      );
    if (error) throw new Error(error.message);

    const byCode = new Map<string, AdminPricingRow["dbPlan"]>();
    for (const p of dbPlans ?? []) {
      byCode.set(String(p.code), p as AdminPricingRow["dbPlan"]);
    }

    const rows: AdminPricingRow[] = PLANS.map((plan) => {
      const envKey = plan.lsVariantEnvKey ?? null;
      const envValue = envKey ? process.env[envKey] : undefined;
      return {
        plan,
        lsVariantEnvKey: envKey,
        lsVariantConfigured: Boolean(envValue && envValue.trim().length > 0),
        dbPlan: byCode.get(plan.code) ?? null,
      };
    });

    return {
      trialDays: TRIAL_DAYS,
      rows,
      storeId: process.env.LEMONSQUEEZY_STORE_ID?.trim() || null,
      webhookSecretConfigured: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()),
    };
  });
