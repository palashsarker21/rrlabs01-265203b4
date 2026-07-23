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
} from "@/lib/lemon-squeezy";

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
      "https://rrlabs01.lovable.app";
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
        .update({
          status: "failed",
          provider_error: text.slice(0, 2000),
          provider_status_code: res.status,
          last_attempt_at: new Date().toISOString(),
        } as never)
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
      await supabaseAdmin
        .from("checkout_sessions")
        .update({
          status: "failed",
          provider_error: "Checkout URL was not returned by Lemon Squeezy.",
          last_attempt_at: new Date().toISOString(),
        } as never)
        .eq("id", session.id);
      throw new Error("Checkout URL was not returned by Lemon Squeezy.");
    }

    await supabaseAdmin
      .from("checkout_sessions")
      .update({
        ls_checkout_id: checkoutId,
        ls_checkout_url: checkoutUrl,
        last_attempt_at: new Date().toISOString(),
      } as never)
      .eq("id", session.id);

    return { url: checkoutUrl, sessionId: session.id };
  });

/**
 * Public: list active plans in the unified `PricingPlan` shape used by
 * every marketing/app pricing surface. All display copy is read from the
 * `public.plans` table (Wave 2 SSOT). The raw LS variant id is never
 * exposed — we only expose whether a self-serve variant is resolvable.
 */
export const listPublicPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<import("@/lib/pricing").PricingPlan[]> => {
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
        "id, code, name, description, tagline, price_cents, price_display, price_suffix, price_lead, currency, interval, trial_days, features, features_lead, sort_order, success_fee_bps, success_fee_label, monthly_base_cents, highlight, is_marketed_enterprise, is_contact_sales, starting_at_price_cents, cta_kind, cta_label, ls_variant_id",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;

    return (data ?? []).map((p) => {
      const variantId =
        cleanVariantId(envVariantForPlan(p.code)) ?? cleanVariantId(p.ls_variant_id);
      const hasVariant = !p.is_contact_sales && (Boolean(variantId) || isSelfServePlan(p.code));
      const features = Array.isArray(p.features)
        ? (p.features as unknown[]).filter((f): f is string => typeof f === "string")
        : [];
      const ctaKind: "trial" | "contact_sales" =
        (p.cta_kind as string) === "contact_sales" ? "contact_sales" : "trial";
      const priceDisplay =
        p.price_display ??
        (p.price_cents != null
          ? `$${Math.round(p.price_cents / 100)}`
          : p.starting_at_price_cents != null
            ? "Custom"
            : "Custom");
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        tagline: p.tagline ?? null,
        description: p.description ?? null,
        priceDisplay,
        priceSuffix: p.price_suffix ?? (p.price_cents != null ? `/${p.interval ?? "month"}` : null),
        priceLead: p.price_lead ?? null,
        successFeeBps: p.success_fee_bps ?? null,
        successFeeLabel: p.success_fee_label ?? null,
        monthlyBaseCents: p.monthly_base_cents ?? p.price_cents ?? null,
        featuresLead: p.features_lead ?? null,
        features,
        ctaKind,
        ctaLabel: p.cta_label ?? (ctaKind === "contact_sales" ? "Talk to Sales" : "Get Started"),
        highlight: Boolean(p.highlight),
        isMarketedEnterprise: Boolean(p.is_marketed_enterprise),
        isContactSales: Boolean(p.is_contact_sales),
        trialDays: p.trial_days ?? 14,
        currency: p.currency ?? "USD",
        interval: p.interval ?? "month",
        startingAtPriceCents: p.starting_at_price_cents ?? null,
        sortOrder: p.sort_order ?? 0,
        hasVariant,
      };
    });
  },
);

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
