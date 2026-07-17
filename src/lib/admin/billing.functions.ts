/**
 * Admin billing / checkout diagnostics.
 *
 * - listAdminCheckoutSessions: paginated list of every Lemon Squeezy checkout
 *   session with plan, org, workspace, status and the raw provider error.
 * - runCheckoutSanityTest: hits the real Lemon Squeezy API to create a
 *   checkout for Starter, Growth, and Business/Scale so we can prove in
 *   production that the "temporarily unavailable" path never triggers.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cleanVariantId,
  envVariantForPlan,
  lemonHeaders,
  resolveLemonSqueezyVariant,
} from "@/lib/lemon-squeezy";

async function assertSuperAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (
      fn: "is_super_admin",
      args: { _user_id: string },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await sb.rpc("is_super_admin", { _user_id: context.userId });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

export type AdminCheckoutRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_attempt_at: string | null;
  organization_name: string;
  workspace_name: string;
  user_id: string;
  user_email: string | null;
  plan_id: string;
  plan_code: string | null;
  plan_name: string | null;
  ls_checkout_id: string | null;
  ls_checkout_url: string | null;
  provider_error: string | null;
  provider_status_code: number | null;
  fulfilled_workspace_id: string | null;
  fulfilled_workspace_name: string | null;
};

export const listAdminCheckoutSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCheckoutRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("checkout_sessions")
      .select("*, plans:plan_id(code, name), workspaces:fulfilled_workspace_id(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

    const userIds = Array.from(new Set(rows.map((r) => String(r.user_id)).filter(Boolean)));
    const emailByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        if (p.email) emailByUserId.set(p.id, p.email);
      }
    }

    return rows.map((r) => {
      const plan = (r.plans ?? null) as { code?: string; name?: string } | null;
      const ws = (r.workspaces ?? null) as { name?: string } | null;
      return {
        id: String(r.id),
        status: String(r.status ?? "pending"),
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        last_attempt_at: (r.last_attempt_at as string | null) ?? null,
        organization_name: String(r.organization_name ?? ""),
        workspace_name: String(r.workspace_name ?? ""),
        user_id: String(r.user_id),
        user_email: emailByUserId.get(String(r.user_id)) ?? null,
        plan_id: String(r.plan_id),
        plan_code: plan?.code ?? null,
        plan_name: plan?.name ?? null,
        ls_checkout_id: (r.ls_checkout_id as string | null) ?? null,
        ls_checkout_url: (r.ls_checkout_url as string | null) ?? null,
        provider_error: (r.provider_error as string | null) ?? null,
        provider_status_code: (r.provider_status_code as number | null) ?? null,
        fulfilled_workspace_id: (r.fulfilled_workspace_id as string | null) ?? null,
        fulfilled_workspace_name: ws?.name ?? null,
      };
    });
  });

export type CheckoutTestResult = {
  planCode: string;
  planName: string;
  ok: boolean;
  variantId?: string;
  variantSource?: string;
  checkoutUrl?: string;
  statusCode?: number;
  error?: string;
  durationMs: number;
};

const TEST_PLAN_CODES = ["starter", "growth", "business", "scale"] as const;

export const runCheckoutSanityTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckoutTestResult[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!apiKey || !storeId) {
      throw new Error(
        "LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID must be set to run the checkout test.",
      );
    }

    const { data: plans, error } = await supabaseAdmin
      .from("plans")
      .select("id, code, name, ls_variant_id, is_active, is_contact_sales")
      .in("code", TEST_PLAN_CODES as unknown as string[]);
    if (error) throw new Error(error.message);

    const results: CheckoutTestResult[] = [];
    for (const plan of plans ?? []) {
      const started = Date.now();
      const base: CheckoutTestResult = {
        planCode: plan.code,
        planName: plan.name,
        ok: false,
        durationMs: 0,
      };

      if (!plan.is_active) {
        results.push({
          ...base,
          error: "Plan is not active.",
          durationMs: Date.now() - started,
        });
        continue;
      }
      if (plan.is_contact_sales) {
        results.push({
          ...base,
          ok: true,
          error: "Skipped — contact-sales plan.",
          durationMs: Date.now() - started,
        });
        continue;
      }

      try {
        const variant = await resolveLemonSqueezyVariant({
          plan: {
            code: plan.code,
            name: plan.name,
            ls_variant_id: plan.ls_variant_id,
          },
          apiKey,
          storeId,
        });
        if (!variant) {
          results.push({
            ...base,
            error: `No Lemon Squeezy variant configured. env=${Boolean(
              cleanVariantId(envVariantForPlan(plan.code)),
            )} db=${Boolean(cleanVariantId(plan.ls_variant_id))}`,
            durationMs: Date.now() - started,
          });
          continue;
        }

        const body = {
          data: {
            type: "checkouts",
            attributes: {
              checkout_data: {
                email: "sanity+test@rrlabs.online",
                custom: { sanity_test: "true", plan_code: plan.code },
              },
              product_options: {
                enabled_variants: [Number(variant.id)].filter((n) => Number.isFinite(n)),
              },
              checkout_options: { embed: false, dark: true, logo: true },
            },
            relationships: {
              store: { data: { type: "stores", id: storeId } },
              variant: { data: { type: "variants", id: variant.id } },
            },
          },
        };

        const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
          method: "POST",
          headers: lemonHeaders(apiKey),
          body: JSON.stringify(body),
        });
        const text = await res.text();

        if (!res.ok) {
          results.push({
            ...base,
            statusCode: res.status,
            variantId: variant.id,
            variantSource: variant.source,
            error: text.slice(0, 500),
            durationMs: Date.now() - started,
          });
          continue;
        }

        const json = JSON.parse(text) as {
          data?: { attributes?: { url?: string } };
        };
        const url = json.data?.attributes?.url;
        if (!url) {
          results.push({
            ...base,
            statusCode: res.status,
            variantId: variant.id,
            variantSource: variant.source,
            error: "No checkout URL returned by Lemon Squeezy.",
            durationMs: Date.now() - started,
          });
          continue;
        }

        results.push({
          ...base,
          ok: true,
          statusCode: res.status,
          variantId: variant.id,
          variantSource: variant.source,
          checkoutUrl: url,
          durationMs: Date.now() - started,
        });
      } catch (err) {
        results.push({
          ...base,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - started,
        });
      }
    }

    return results;
  });
