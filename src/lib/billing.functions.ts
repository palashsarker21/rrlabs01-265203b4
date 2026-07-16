import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertBillingEnv } from "@/lib/billing-env";
import {
  cleanVariantId,
  envVariantForPlan,
  isSelfServePlan,
  lemonHeaders,
  resolveLemonSqueezyVariant,
} from "@/lib/lemon-squeezy.server";

const createCheckoutInput = z.object({
  planId: z.string().uuid(),
  organizationName: z.string().min(2).max(80),
  workspaceName: z.string().min(2).max(80),
});

/**
 * Creates a Lemon Squeezy hosted checkout for the selected plan and records
 * a pending checkout_sessions row. The workspace is provisioned AFTER the
 * webhook confirms the subscription — never before.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createCheckoutInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select(
        "id, code, name, ls_variant_id, price_cents, currency, trial_days, is_active, is_contact_sales",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (planErr || !plan || !plan.is_active) {
      throw new Error("Selected plan is not available.");
    }
    if (plan.is_contact_sales) {
      throw new Error("This plan is only available through our sales team.");
    }

    assertBillingEnv();

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!apiKey || !storeId) {
      throw new Error(
        "Billing is not fully configured yet. LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID must be set.",
      );
    }

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
      console.error("[checkout] could not resolve Lemon Squeezy variant", {
        planCode: plan.code,
        planName: plan.name,
        dbVariantConfigured: Boolean(cleanVariantId(plan.ls_variant_id)),
        envVariantConfigured: Boolean(cleanVariantId(envVariantForPlan(plan.code))),
      });
      throw new Error(
        `No Lemon Squeezy checkout variant is configured for ${plan.name}. Please contact support@rrlabs.online.`,
      );
    }
    const variantId = variant.id;

    // Record pending checkout first so the webhook can reconcile it.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("checkout_sessions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        workspace_name: data.workspaceName,
        organization_name: data.organizationName,
      })
      .select("id")
      .single();
    if (sessErr || !session) {
      throw new Error(sessErr?.message ?? "Could not start checkout.");
    }

    // Derive origin for redirect_url.
    const publishedOrigin =
      process.env.APP_URL ??
      (process.env.LOVABLE_PROJECT_ID
        ? `https://project--${process.env.LOVABLE_PROJECT_ID}.lovable.app`
        : undefined) ??
      "https://rrlabs.lovable.app";
    const redirectUrl = `${publishedOrigin}/checkout/status?session=${session.id}`;

    const email = (claims as { email?: string }).email;

    const body = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: email ?? undefined,
            custom: {
              checkout_session_id: session.id,
              user_id: userId,
              plan_id: plan.id,
            },
          },
          product_options: {
            enabled_variants: [Number(variantId)].filter((n) => Number.isFinite(n)),
            redirect_url: redirectUrl,
            receipt_button_text: "Return to RRLabs",
            receipt_link_url: redirectUrl,
          },
          checkout_options: {
            embed: false,
            dark: true,
            logo: true,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    };

    const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: lemonHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[checkout] Lemon Squeezy checkout creation failed", {
        status: res.status,
        planCode: plan.code,
        variantSource: variant.source,
        variantId,
        storeId,
        redirectUrl,
        response: text,
      });
      await supabaseAdmin
        .from("checkout_sessions")
        .update({ status: "failed" })
        .eq("id", session.id);
      throw new Error(
        `Lemon Squeezy rejected checkout creation for ${plan.name} (HTTP ${res.status}). Please try again or contact support.`,
      );
    }

    const json = (await res.json()) as {
      data?: { id?: string; attributes?: { url?: string } };
    };
    const checkoutId = json.data?.id;
    const checkoutUrl = json.data?.attributes?.url;
    if (!checkoutUrl) {
      throw new Error("Checkout URL was not returned by Lemon Squeezy.");
    }

    await supabaseAdmin
      .from("checkout_sessions")
      .update({ ls_checkout_id: checkoutId, ls_checkout_url: checkoutUrl })
      .eq("id", session.id);

    return { url: checkoutUrl, sessionId: session.id };
  });

/**
 * Public: list active plans + whether each has a working self-serve variant.
 * Enterprise / contact-sales rows are included with `has_variant=false`.
 * We never expose the raw variant ID to the client.
 */
export const listPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client
    .from("plans")
    .select(
      "id, code, name, description, price_cents, currency, interval, trial_days, features, sort_order, success_fee_bps, is_contact_sales, starting_at_price_cents, ls_variant_id",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((p) => {
    const variantId = cleanVariantId(envVariantForPlan(p.code)) ?? cleanVariantId(p.ls_variant_id);
    const hasVariant = !p.is_contact_sales && (Boolean(variantId) || isSelfServePlan(p.code));
    // Strip the raw variant id from the public payload.
    const { ls_variant_id: _drop, ...rest } = p;
    return { ...rest, has_variant: hasVariant };
  });
});

const statusInput = z.object({ sessionId: z.string().uuid() });

/**
 * Polled by /checkout/status after the customer returns from Lemon Squeezy.
 * Returns the current fulfillment state so the UI can flip between the
 * in-progress, success, and failure views.
 */
export const getCheckoutSessionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => statusInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("checkout_sessions")
      .select(
        "id, status, fulfilled_workspace_id, plan_id, organization_name, workspace_name, created_at",
      )
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { state: "not_found" as const };

    let workspaceSlug: string | null = null;
    let planName: string | null = null;
    if (row.fulfilled_workspace_id) {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("slug")
        .eq("id", row.fulfilled_workspace_id)
        .maybeSingle();
      workspaceSlug = ws?.slug ?? null;
    }
    if (row.plan_id) {
      const { data: plan } = await supabase
        .from("plans")
        .select("name")
        .eq("id", row.plan_id)
        .maybeSingle();
      planName = plan?.name ?? null;
    }

    // Treat sessions still pending after 15 minutes as timed out — the LS
    // webhook always fires well before that on success.
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const isStale = row.status === "pending" && ageMs > 15 * 60 * 1000;

    const state: "pending" | "completed" | "failed" | "timeout" =
      row.status === "completed"
        ? "completed"
        : row.status === "failed"
          ? "failed"
          : isStale
            ? "timeout"
            : "pending";

    return {
      state,
      workspaceSlug,
      planName,
      organizationName: row.organization_name,
    };
  });

