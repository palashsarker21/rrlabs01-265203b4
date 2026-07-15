import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the billing summary for a workspace: plan, subscription, trial,
 * customer-portal URL, update-payment URL, card brand/last4, renewal date.
 *
 * Read as the signed-in user under RLS. If the caller is not a member the
 * server returns `null` rather than 403 so the UI can render a graceful
 * empty state.
 */
export const getWorkspaceBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, status, trial_ends_at, trial_started_at, subscription_status")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (!ws) return null;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "id, status, plan_id, ls_subscription_id, trial_ends_at, renews_at, ends_at, cancelled_at, update_payment_url, customer_portal_url, card_brand, card_last_four, created_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let plan: {
      id: string;
      code: string;
      name: string;
      price_cents: number | null;
      currency: string | null;
      interval: string | null;
      success_fee_bps: number | null;
    } | null = null;
    if (sub?.plan_id) {
      const { data: p } = await supabase
        .from("plans")
        .select("id, code, name, price_cents, currency, interval, success_fee_bps")
        .eq("id", sub.plan_id)
        .maybeSingle();
      plan = p ?? null;
    }

    return { workspace: ws, subscription: sub, plan };
  });

/**
 * Super-admin billing metrics: MRR, ARR, active subs, trials, cancels,
 * conversion rate, recovered revenue. Refuses if caller isn't super_admin.
 */
export const getBillingMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Active subs joined with plan price for MRR.
    const { data: active } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status, plan:plans(price_cents, currency, interval)")
      .in("status", ["active", "on_trial"]);

    let mrrCents = 0;
    let activeCount = 0;
    let trialCount = 0;
    for (const s of active ?? []) {
      const price = s.plan?.price_cents ?? 0;
      const monthly = s.plan?.interval === "year" ? Math.round(price / 12) : price;
      if (s.status === "active") {
        mrrCents += monthly;
        activeCount++;
      } else if (s.status === "on_trial") {
        trialCount++;
      }
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString();

    const { count: cancelled30 } = await supabaseAdmin
      .from("subscriptions")
      .select("id", { head: true, count: "exact" })
      .in("status", ["cancelled", "expired"])
      .gte("cancelled_at", thirtyDaysAgo);

    // Conversion: subs created in last 90d that ever reached 'active'.
    const { count: trialsStarted } = await supabaseAdmin
      .from("subscriptions")
      .select("id", { head: true, count: "exact" })
      .gte("created_at", ninetyDaysAgo);
    const { count: convertedTrials } = await supabaseAdmin
      .from("subscriptions")
      .select("id", { head: true, count: "exact" })
      .gte("created_at", ninetyDaysAgo)
      .eq("status", "active");
    const conversionRate =
      trialsStarted && trialsStarted > 0 ? (convertedTrials ?? 0) / trialsStarted : 0;

    // Recovered revenue (product-side metric).
    const { data: recovered } = await supabaseAdmin
      .from("recovery_events")
      .select("amount_cents")
      .eq("status", "recovered");
    const recoveredCents = (recovered ?? []).reduce(
      (sum, r) => sum + (r.amount_cents ?? 0),
      0,
    );

    return {
      mrrCents,
      arrCents: mrrCents * 12,
      activeCount,
      trialCount,
      cancelled30dCount: cancelled30 ?? 0,
      conversionRate,
      recoveredCents,
      currency: "USD",
    };
  });
