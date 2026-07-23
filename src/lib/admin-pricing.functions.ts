import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminPricingPlanRow = {
  id: string;
  code: string;
  name: string;
  price_cents: number | null;
  currency: string;
  success_fee_bps: number | null;
  trial_days: number;
  is_active: boolean;
  is_contact_sales: boolean;
  highlight: boolean;
  is_marketed_enterprise: boolean;
  cta_kind: string;
  cta_label: string;
  price_display: string | null;
  ls_variant_id: string | null;
  ls_variant_env_key: string | null;
  ls_variant_env_configured: boolean;
  sort_order: number;
};

export type AdminPricingSnapshot = {
  rows: AdminPricingPlanRow[];
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

/**
 * Read-only pricing configuration snapshot for the admin console. As of the
 * Wave 2 Pricing SSOT refactor, this reads directly from `public.plans` (no
 * hardcoded plan list) and enriches each row with the presence of its
 * configured Lemon Squeezy variant env var.
 */
export const getAdminPricingSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPricingSnapshot> => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);

    const { data, error } = await supabase
      .from("plans")
      .select(
        "id, code, name, price_cents, currency, success_fee_bps, trial_days, is_active, is_contact_sales, highlight, is_marketed_enterprise, cta_kind, cta_label, price_display, ls_variant_id, ls_variant_env_key, sort_order",
      )
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const rows: AdminPricingPlanRow[] = (data ?? []).map((p) => {
      const envKey = p.ls_variant_env_key ?? null;
      const envValue = envKey ? process.env[envKey] : undefined;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        price_cents: p.price_cents ?? null,
        currency: p.currency ?? "USD",
        success_fee_bps: p.success_fee_bps ?? null,
        trial_days: p.trial_days ?? 14,
        is_active: Boolean(p.is_active),
        is_contact_sales: Boolean(p.is_contact_sales),
        highlight: Boolean(p.highlight),
        is_marketed_enterprise: Boolean(p.is_marketed_enterprise),
        cta_kind: p.cta_kind ?? "trial",
        cta_label: p.cta_label ?? "Get Started",
        price_display: p.price_display ?? null,
        ls_variant_id: p.ls_variant_id ?? null,
        ls_variant_env_key: envKey,
        ls_variant_env_configured: Boolean(envValue && envValue.trim().length > 0),
        sort_order: p.sort_order ?? 0,
      };
    });

    return {
      rows,
      storeId: process.env.LEMONSQUEEZY_STORE_ID?.trim() || null,
      webhookSecretConfigured: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()),
    };
  });
