/**
 * Success Fee — server functions exposed to the client.
 *
 * Statements listing/reading is available to workspace members under RLS.
 * All mutations (adjustments, finalize, invoice, void, build) require
 * super_admin.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: unknown; userId: string }): Promise<void> {
  const sb = context.supabase as {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "super_admin" },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await sb.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

// -------------------------------------------------------------------
// Read
// -------------------------------------------------------------------

export type SuccessFeeStatementRow = {
  id: string;
  workspace_id: string;
  workspace_name: string | null;
  organization_name: string | null;
  period_start: string;
  period_end: string;
  currency: string;
  recovered_amount_cents: number;
  events_count: number;
  fee_bps: number;
  fee_amount_cents: number;
  adjustments_total_cents: number;
  net_amount_cents: number;
  status: "draft" | "finalized" | "invoiced" | "paid" | "voided";
  ls_invoice_id: string | null;
  ls_checkout_url: string | null;
  ls_order_id: string | null;
  provider_error: string | null;
  finalized_at: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
};

export const listSuccessFeeStatements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid().optional(),
        status: z.enum(["draft", "finalized", "invoiced", "paid", "voided"]).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<SuccessFeeStatementRow[]> => {
    const { supabase } = context;
    let query = supabase
      .from("success_fee_statements")
      .select(
        "id, workspace_id, period_start, period_end, currency, recovered_amount_cents, events_count, fee_bps, fee_amount_cents, adjustments_total_cents, net_amount_cents, status, ls_invoice_id, ls_checkout_url, ls_order_id, provider_error, finalized_at, invoiced_at, paid_at, voided_at, created_at, workspaces:workspace_id(name, organizations:organization_id(name))",
      )
      .order("period_start", { ascending: false })
      .limit(500);
    if (data.workspaceId) query = query.eq("workspace_id", data.workspaceId);
    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const ws = (r.workspaces ?? null) as {
        name?: string;
        organizations?: { name?: string } | null;
      } | null;
      return {
        id: String(r.id),
        workspace_id: String(r.workspace_id),
        workspace_name: ws?.name ?? null,
        organization_name: ws?.organizations?.name ?? null,
        period_start: String(r.period_start),
        period_end: String(r.period_end),
        currency: String(r.currency),
        recovered_amount_cents: Number(r.recovered_amount_cents ?? 0),
        events_count: Number(r.events_count ?? 0),
        fee_bps: Number(r.fee_bps ?? 0),
        fee_amount_cents: Number(r.fee_amount_cents ?? 0),
        adjustments_total_cents: Number(r.adjustments_total_cents ?? 0),
        net_amount_cents: Number(r.net_amount_cents ?? 0),
        status: r.status as SuccessFeeStatementRow["status"],
        ls_invoice_id: (r.ls_invoice_id as string | null) ?? null,
        ls_checkout_url: (r.ls_checkout_url as string | null) ?? null,
        ls_order_id: (r.ls_order_id as string | null) ?? null,
        provider_error: (r.provider_error as string | null) ?? null,
        finalized_at: (r.finalized_at as string | null) ?? null,
        invoiced_at: (r.invoiced_at as string | null) ?? null,
        paid_at: (r.paid_at as string | null) ?? null,
        voided_at: (r.voided_at as string | null) ?? null,
        created_at: String(r.created_at),
      };
    });
  });

export type SuccessFeeAdjustmentRow = {
  id: string;
  kind: "credit" | "debit" | "refund" | "manual";
  amount_cents: number;
  reason: string;
  actor_user_id: string | null;
  created_at: string;
};

export const getSuccessFeeStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: st, error } = await supabase
      .from("success_fee_statements")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!st) return null;

    const { data: adj } = await supabase
      .from("success_fee_adjustments")
      .select("id, kind, amount_cents, reason, actor_user_id, created_at")
      .eq("statement_id", data.id)
      .order("created_at", { ascending: false });

    return {
      statement: st as unknown as SuccessFeeStatementRow,
      adjustments: (adj ?? []) as unknown as SuccessFeeAdjustmentRow[],
    };
  });

// -------------------------------------------------------------------
// Workspace-scoped summary (used by BillingPanel)
// -------------------------------------------------------------------

export type WorkspaceSuccessFeeSummary = {
  currentMonth: {
    label: string;
    recoveredCents: number;
    accruedFeeCents: number;
    feeBps: number;
  };
  lastFinalized: SuccessFeeStatementRow | null;
  outstandingInvoice: SuccessFeeStatementRow | null;
};

export const getWorkspaceSuccessFeeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<WorkspaceSuccessFeeSummary> => {
    const { supabase } = context;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const [recAgg, subRes, latestRes, invRes] = await Promise.all([
      supabase
        .from("recovery_events")
        .select("amount_cents")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "recovered")
        .gte("recovered_at", monthStart),
      supabase
        .from("subscriptions")
        .select("plans:plan_id(success_fee_bps)")
        .eq("workspace_id", data.workspaceId)
        .in("status", ["active", "on_trial", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("success_fee_statements")
        .select("*")
        .eq("workspace_id", data.workspaceId)
        .in("status", ["finalized", "invoiced", "paid"])
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("success_fee_statements")
        .select("*")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "invoiced")
        .order("invoiced_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const recovered = (recAgg.data ?? []).reduce((sum, r) => sum + Number(r.amount_cents ?? 0), 0);
    const feeBps = Number(
      ((subRes.data?.plans ?? null) as { success_fee_bps?: number | null } | null)
        ?.success_fee_bps ?? 0,
    );
    const label = `${monthStart.slice(0, 7)}`;

    return {
      currentMonth: {
        label,
        recoveredCents: recovered,
        accruedFeeCents: Math.round((recovered * feeBps) / 10_000),
        feeBps,
      },
      lastFinalized: (latestRes.data as unknown as SuccessFeeStatementRow) ?? null,
      outstandingInvoice: (invRes.data as unknown as SuccessFeeStatementRow) ?? null,
    };
  });

// -------------------------------------------------------------------
// Mutations (super_admin)
// -------------------------------------------------------------------

export const addSuccessFeeAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        statementId: z.string().uuid(),
        kind: z.enum(["credit", "debit", "refund", "manual"]),
        amount_cents: z.number().int().positive().max(100_000_000),
        reason: z.string().min(3).max(500),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: st, error: stErr } = await supabaseAdmin
      .from("success_fee_statements")
      .select("id, workspace_id, status")
      .eq("id", data.statementId)
      .maybeSingle();
    if (stErr || !st) throw new Error(stErr?.message ?? "Statement not found.");
    if (st.status === "paid" || st.status === "voided") {
      throw new Error(`Statement is ${st.status} — no further adjustments allowed.`);
    }

    const { error: insErr } = await supabaseAdmin.from("success_fee_adjustments").insert({
      statement_id: data.statementId,
      workspace_id: st.workspace_id,
      kind: data.kind,
      amount_cents: data.amount_cents,
      reason: data.reason,
      actor_user_id: context.userId,
    });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.rpc("recompute_success_fee_statement", {
      _statement_id: data.statementId,
    });

    return { ok: true };
  });

export const finalizeSuccessFeeStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: st, error } = await supabaseAdmin
      .from("success_fee_statements")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !st) throw new Error(error?.message ?? "Statement not found.");
    if (st.status !== "draft") {
      throw new Error(`Only draft statements can be finalized (current: ${st.status}).`);
    }

    const { error: upErr } = await supabaseAdmin
      .from("success_fee_statements")
      .update({ status: "finalized", finalized_at: new Date().toISOString() })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const issueSuccessFeeInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { issueInvoiceForStatement } = await import("@/lib/success-fee/engine.server");
    return issueInvoiceForStatement(data.id);
  });

export const voidSuccessFeeStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("success_fee_statements")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        notes: data.reason,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runMonthlySuccessFeeBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        // ISO 8601 anchor date whose previous UTC month should be built.
        anchor: z.string().datetime().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { previousMonthBounds, buildStatementsForPeriod } =
      await import("@/lib/success-fee/engine.server");
    const anchor = data.anchor ? new Date(data.anchor) : new Date();
    const period = previousMonthBounds(anchor);
    return buildStatementsForPeriod(period);
  });

// -------------------------------------------------------------------
// CSV export
// -------------------------------------------------------------------

export const exportSuccessFeeCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("success_fee_statements")
      .select(
        "period_start, period_end, workspace_id, currency, recovered_amount_cents, events_count, fee_bps, fee_amount_cents, adjustments_total_cents, net_amount_cents, status, ls_invoice_id, ls_order_id, invoiced_at, paid_at, workspaces:workspace_id(name, organizations:organization_id(name))",
      )
      .order("period_start", { ascending: false })
      .limit(5000);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    if (data.from) q = q.gte("period_start", data.from);
    if (data.to) q = q.lt("period_end", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const header = [
      "period",
      "organization",
      "workspace",
      "currency",
      "recovered_cents",
      "events",
      "fee_bps",
      "fee_cents",
      "adjustments_cents",
      "net_cents",
      "status",
      "ls_invoice_id",
      "ls_order_id",
      "invoiced_at",
      "paid_at",
    ];
    const body = (rows ?? []).map((r) => {
      const ws = (r.workspaces ?? null) as {
        name?: string;
        organizations?: { name?: string } | null;
      } | null;
      return [
        String(r.period_start).slice(0, 7),
        csvEscape(ws?.organizations?.name ?? ""),
        csvEscape(ws?.name ?? ""),
        String(r.currency ?? ""),
        String(r.recovered_amount_cents ?? 0),
        String(r.events_count ?? 0),
        String(r.fee_bps ?? 0),
        String(r.fee_amount_cents ?? 0),
        String(r.adjustments_total_cents ?? 0),
        String(r.net_amount_cents ?? 0),
        String(r.status ?? ""),
        csvEscape((r.ls_invoice_id as string | null) ?? ""),
        csvEscape((r.ls_order_id as string | null) ?? ""),
        String(r.invoiced_at ?? ""),
        String(r.paid_at ?? ""),
      ].join(",");
    });
    return { csv: [header.join(","), ...body].join("\n") };
  });

function csvEscape(v: string): string {
  if (!v) return "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
