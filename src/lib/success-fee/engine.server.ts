/**
 * Success Fee engine — server-only.
 *
 * Responsibilities:
 *   1. Build/refresh draft statements for a billing period (idempotent).
 *   2. Issue a one-time Lemon Squeezy checkout for a finalized statement.
 *
 * Never import at the module scope of a `.functions.ts` file — load inside
 * the server-function handler. This module reads secrets from process.env.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SUCCESS_FEE_VARIANT_ENV } from "@/lib/billing-env";
import { cleanVariantId, lemonHeaders } from "@/lib/lemon-squeezy";

export type PeriodBounds = {
  /** ISO string, inclusive lower bound (UTC month start). */
  periodStart: string;
  /** ISO string, exclusive upper bound (UTC next-month start). */
  periodEnd: string;
  /** e.g. "2026-06" — used only for descriptions. */
  label: string;
};

/**
 * Compute the [start, end) UTC bounds for the previous calendar month
 * relative to `now`. Idempotent — same input, same output.
 */
export function previousMonthBounds(now: Date = new Date()): PeriodBounds {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    label,
  };
}

export function monthBounds(year: number, monthZeroIndexed: number): PeriodBounds {
  const start = new Date(Date.UTC(year, monthZeroIndexed, 1));
  const end = new Date(Date.UTC(year, monthZeroIndexed + 1, 1));
  const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { periodStart: start.toISOString(), periodEnd: end.toISOString(), label };
}

export type BuildResult = {
  period: PeriodBounds;
  workspacesProcessed: number;
  statementsCreated: number;
  statementsUpdated: number;
  statementsSkipped: number;
};

/**
 * Build (or refresh) draft statements for every workspace that had
 * `recovered` events during the period. Never touches finalized/invoiced
 * statements — those are locked.
 */
export async function buildStatementsForPeriod(period: PeriodBounds): Promise<BuildResult> {
  const result: BuildResult = {
    period,
    workspacesProcessed: 0,
    statementsCreated: 0,
    statementsUpdated: 0,
    statementsSkipped: 0,
  };

  // Aggregate recovered revenue per workspace in the window.
  const { data: rows, error } = await supabaseAdmin
    .from("recovery_events")
    .select("workspace_id, amount_cents, currency")
    .eq("status", "recovered")
    .gte("recovered_at", period.periodStart)
    .lt("recovered_at", period.periodEnd);
  if (error) throw new Error(`Aggregation failed: ${error.message}`);

  const byWorkspace = new Map<
    string,
    { amount: number; count: number; currency: string | null }
  >();
  for (const r of rows ?? []) {
    const wsId = String(r.workspace_id);
    const bucket = byWorkspace.get(wsId) ?? { amount: 0, count: 0, currency: null };
    bucket.amount += Number(r.amount_cents ?? 0);
    bucket.count += 1;
    bucket.currency = bucket.currency ?? (r.currency as string | null) ?? null;
    byWorkspace.set(wsId, bucket);
  }

  result.workspacesProcessed = byWorkspace.size;
  if (byWorkspace.size === 0) return result;

  // Resolve active plan + success_fee_bps per workspace.
  const wsIds = Array.from(byWorkspace.keys());
  const { data: subs } = await supabaseAdmin
    .from("subscriptions")
    .select("workspace_id, plan_id, plans:plan_id(id, success_fee_bps, currency)")
    .in("workspace_id", wsIds)
    .in("status", ["active", "on_trial", "past_due"]);

  const planByWorkspace = new Map<
    string,
    { planId: string | null; feeBps: number; currency: string }
  >();
  for (const s of subs ?? []) {
    const plan = (s.plans ?? null) as {
      id?: string;
      success_fee_bps?: number | null;
      currency?: string | null;
    } | null;
    planByWorkspace.set(String(s.workspace_id), {
      planId: plan?.id ?? (s.plan_id as string | null) ?? null,
      feeBps: Number(plan?.success_fee_bps ?? 0),
      currency: plan?.currency ?? "USD",
    });
  }

  for (const [wsId, bucket] of byWorkspace.entries()) {
    const plan = planByWorkspace.get(wsId) ?? { planId: null, feeBps: 0, currency: "USD" };
    const currency = (bucket.currency ?? plan.currency ?? "USD").toUpperCase();
    const feeCents = Math.round((bucket.amount * plan.feeBps) / 10_000);

    // Skip if a statement for this window is already locked.
    const { data: existing } = await supabaseAdmin
      .from("success_fee_statements")
      .select("id, status")
      .eq("workspace_id", wsId)
      .eq("period_start", period.periodStart)
      .maybeSingle();

    if (existing && existing.status !== "draft") {
      result.statementsSkipped += 1;
      continue;
    }

    if (existing) {
      await supabaseAdmin
        .from("success_fee_statements")
        .update({
          period_end: period.periodEnd,
          currency,
          recovered_amount_cents: bucket.amount,
          events_count: bucket.count,
          fee_bps: plan.feeBps,
          fee_amount_cents: feeCents,
          plan_id: plan.planId,
        })
        .eq("id", existing.id);
      await supabaseAdmin.rpc("recompute_success_fee_statement", {
        _statement_id: existing.id,
      });
      result.statementsUpdated += 1;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("success_fee_statements")
        .insert({
          workspace_id: wsId,
          period_start: period.periodStart,
          period_end: period.periodEnd,
          currency,
          recovered_amount_cents: bucket.amount,
          events_count: bucket.count,
          fee_bps: plan.feeBps,
          fee_amount_cents: feeCents,
          plan_id: plan.planId,
          status: "draft",
          net_amount_cents: feeCents,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`Insert failed for workspace ${wsId}: ${insErr.message}`);
      if (inserted) {
        await supabaseAdmin.rpc("recompute_success_fee_statement", {
          _statement_id: inserted.id,
        });
      }
      result.statementsCreated += 1;
    }
  }

  return result;
}

export type IssueInvoiceResult = {
  statementId: string;
  checkoutUrl: string;
  checkoutId: string;
};

/**
 * Create a Lemon Squeezy hosted checkout for a finalized statement, using
 * `custom_price` so a single "Success fee" variant can bill any amount.
 */
export async function issueInvoiceForStatement(
  statementId: string,
): Promise<IssueInvoiceResult> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = cleanVariantId(process.env[SUCCESS_FEE_VARIANT_ENV]);
  if (!apiKey || !storeId) {
    throw new Error("Lemon Squeezy is not configured (missing API key or store ID).");
  }
  if (!variantId) {
    throw new Error(
      `Success fee variant is not configured. Set ${SUCCESS_FEE_VARIANT_ENV} to a numeric Lemon Squeezy variant ID.`,
    );
  }

  const { data: st, error } = await supabaseAdmin
    .from("success_fee_statements")
    .select(
      "id, workspace_id, period_start, period_end, currency, net_amount_cents, status, workspaces:workspace_id(name, organization_id, organizations:organization_id(name, billing_email))",
    )
    .eq("id", statementId)
    .maybeSingle();
  if (error || !st) throw new Error(error?.message ?? "Statement not found.");
  if (st.status !== "finalized") {
    throw new Error(`Statement must be finalized before invoicing (current: ${st.status}).`);
  }
  if (!st.net_amount_cents || st.net_amount_cents <= 0) {
    throw new Error("Statement net amount is zero — nothing to invoice.");
  }

  const ws = (st.workspaces ?? null) as {
    name?: string;
    organizations?: { name?: string; billing_email?: string } | null;
  } | null;
  const orgName = ws?.organizations?.name ?? ws?.name ?? "Customer";
  const billingEmail = ws?.organizations?.billing_email ?? undefined;

  const label = `${new Date(st.period_start).toISOString().slice(0, 7)}`;

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        custom_price: Number(st.net_amount_cents), // in cents
        checkout_data: {
          email: billingEmail,
          name: orgName,
          custom: {
            statement_id: st.id,
            workspace_id: st.workspace_id,
            period: label,
            kind: "success_fee",
          },
        },
        product_options: {
          enabled_variants: [Number(variantId)],
          name: `RRLabs success fee — ${label}`,
          description: `Success fee on recovered revenue for ${label}.`,
          receipt_button_text: "Return to RRLabs",
        },
        checkout_options: { embed: false, dark: true, logo: true },
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
  const text = await res.text();
  if (!res.ok) {
    await supabaseAdmin
      .from("success_fee_statements")
      .update({
        provider_error: text.slice(0, 2000),
        provider_status_code: res.status,
      })
      .eq("id", statementId);
    throw new Error(`Lemon Squeezy rejected invoice creation (HTTP ${res.status}).`);
  }

  const json = JSON.parse(text) as {
    data?: { id?: string; attributes?: { url?: string } };
  };
  const checkoutId = json.data?.id ?? "";
  const checkoutUrl = json.data?.attributes?.url ?? "";
  if (!checkoutUrl) throw new Error("Lemon Squeezy did not return a checkout URL.");

  await supabaseAdmin
    .from("success_fee_statements")
    .update({
      status: "invoiced",
      ls_invoice_id: checkoutId,
      ls_checkout_url: checkoutUrl,
      invoiced_at: new Date().toISOString(),
      provider_error: null,
      provider_status_code: null,
    })
    .eq("id", statementId);

  return { statementId, checkoutUrl, checkoutId };
}
