/**
 * Wave 2 — Customer Directory server functions for the Platform Control Center.
 * All functions are super-admin gated and write to the audit log.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WORKSPACE_STATUSES = [
  "setup",
  "active",
  "paused",
  "suspended",
  "cancelled",
  "trial",
  "expired",
  "pending",
  "archived",
] as const;

type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

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

async function audit(
  context: { supabase: unknown; userId: string; claims: unknown },
  action: string,
  workspaceId: string | null,
  details: Record<string, unknown>,
) {
  const { writeAuditLog } = await import("@/lib/audit.server");
  await writeAuditLog({
    workspaceId,
    actorId: context.userId,
    actorEmail: (context.claims as { email?: string })?.email ?? null,
    action,
    targetType: "workspace",
    targetId: workspaceId,
    details,
  });
}

/** Full customer directory listing (super admin only). */
export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        search: z.string().trim().max(200).optional(),
        status: z.enum(WORKSPACE_STATUSES).optional(),
        engine: z.enum(["on", "off"]).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);

    const { data: overview, error } = await supabase.rpc("admin_workspace_overview");
    if (error) throw new Error(error.message);
    let rows = (overview ?? []) as Array<{
      workspace_id: string;
      workspace_name: string;
      workspace_slug: string;
      organization_id: string;
      organization_name: string;
      status: WorkspaceStatus;
      recovery_engine_enabled: boolean;
      members_count: number;
      integrations_count: number;
      active_integrations_count: number;
      events_count: number;
      recovered_count: number;
      recovered_amount_cents: number;
      created_at: string;
    }>;

    if (data.status) rows = rows.filter((r) => r.status === data.status);
    if (data.engine === "on") rows = rows.filter((r) => r.recovery_engine_enabled);
    if (data.engine === "off") rows = rows.filter((r) => !r.recovery_engine_enabled);
    if (data.search) {
      const q = data.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.workspace_name.toLowerCase().includes(q) ||
          r.workspace_slug.toLowerCase().includes(q) ||
          r.organization_name.toLowerCase().includes(q) ||
          r.workspace_id.toLowerCase().includes(q),
      );
    }

    return rows.slice(0, data.limit);
  });

/** Detailed workspace view for the customer detail page. */
export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      wsR,
      membersR,
      subsR,
      integrationsR,
      eventsCountR,
      recentEventsR,
      recoveredR,
      failedR,
      pendingR,
      recoveredAmountR,
      supportR,
      auditR,
    ] = await Promise.all([
      supabase
        .from("workspaces")
        .select(
          "id, name, slug, status, recovery_engine_enabled, plan_id, subscription_id, subscription_status, trial_started_at, trial_ends_at, setup_step, setup_completed_at, created_at, updated_at, organization_id",
        )
        .eq("id", data.workspaceId)
        .single(),
      supabase
        .from("workspace_members")
        .select("user_id, role, created_at")
        .eq("workspace_id", data.workspaceId),
      supabase
        .from("subscriptions")
        .select(
          "id, plan_id, status, current_period_start, current_period_end, cancelled_at, renews_at, ends_at, card_brand, card_last_four, ls_subscription_id, customer_portal_url, plans(code, name, price_cents, currency, interval)",
        )
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("integrations")
        .select("id, provider, status, health, created_at")
        .eq("workspace_id", data.workspaceId),
      supabase
        .from("recovery_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId),
      supabase
        .from("recovery_events")
        .select(
          "id, status, provider, amount_cents, currency, failure_category, failure_code, next_action, next_run_at, recovered_at, created_at",
        )
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("recovery_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("status", "recovered")
        .gte("recovered_at", since30),
      supabase
        .from("recovery_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("status", "failed")
        .gte("created_at", since30),
      supabase
        .from("recovery_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .in("status", ["pending", "in_progress"])
        .gte("created_at", since30),
      supabase
        .from("recovery_events")
        .select("amount_cents, currency")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "recovered")
        .gte("recovered_at", since30)
        .limit(1000),
      supabase
        .from("support_conversations")
        .select(
          "id, subject, status, priority, category, assigned_to, last_message_at, unread_staff, created_at",
        )
        .eq("workspace_id", data.workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(15),
      supabase
        .from("audit_logs")
        .select("id, action, actor_email, target_type, target_id, details, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (wsR.error) throw new Error(wsR.error.message);

    const recoveredRows = (recoveredAmountR.data ?? []) as Array<{
      amount_cents: number | null;
      currency: string | null;
    }>;
    const recoveredAmountByCurrency: Record<string, number> = {};
    for (const r of recoveredRows) {
      const cur = (r.currency ?? "USD").toUpperCase();
      recoveredAmountByCurrency[cur] = (recoveredAmountByCurrency[cur] ?? 0) + (r.amount_cents ?? 0);
    }

    const subs = (subsR.data ?? []) as Array<{
      id: string;
      status: string | null;
      plan_id: string | null;
      current_period_start: string | null;
      current_period_end: string | null;
      cancelled_at: string | null;
      renews_at: string | null;
      ends_at: string | null;
      card_brand: string | null;
      card_last_four: string | null;
      ls_subscription_id: string | null;
      customer_portal_url: string | null;
      plans:
        | { code: string; name: string; price_cents: number; currency: string; interval: string }
        | null;
    }>;
    const activeSub =
      subs.find((s) => s.status === "active" || s.status === "on_trial" || s.status === "past_due") ??
      subs[0] ??
      null;
    const mrrCents =
      activeSub?.plans?.interval === "month" ? activeSub?.plans?.price_cents ?? null : null;
    const arrCents =
      activeSub?.plans?.interval === "year" ? activeSub?.plans?.price_cents ?? null : null;

    return {
      workspace: wsR.data,
      members: membersR.data ?? [],
      subscriptions: subs,
      subscriptionHealth: {
        active: activeSub,
        mrrCents,
        arrCents,
        currency: activeSub?.plans?.currency ?? "USD",
      },
      integrations: integrationsR.data ?? [],
      eventsCount: eventsCountR.count ?? 0,
      recovery: {
        recentEvents: recentEventsR.data ?? [],
        recovered30d: recoveredR.count ?? 0,
        failed30d: failedR.count ?? 0,
        pending30d: pendingR.count ?? 0,
        recoveredAmountByCurrency,
      },
      support: supportR.data ?? [],
      audit: auditR.data ?? [],
    };
  });


/** Change workspace status (activate / pause / suspend / archive / cancel). */
export const setCustomerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        status: z.enum(WORKSPACE_STATUSES),
        reason: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);
    const { error } = await supabase
      .from("workspaces")
      .update({ status: data.status })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    await audit(context, "admin.workspace.status_changed", data.workspaceId, {
      status: data.status,
      reason: data.reason ?? null,
    });
    return { ok: true as const };
  });

/** Extend or set the trial end date. */
export const extendCustomerTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        days: z.number().int().min(1).max(365),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);
    const { data: ws, error: readErr } = await supabase
      .from("workspaces")
      .select("trial_ends_at")
      .eq("id", data.workspaceId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const base = ws?.trial_ends_at ? new Date(ws.trial_ends_at) : new Date();
    const now = new Date();
    const start = base.getTime() > now.getTime() ? base : now;
    const next = new Date(start.getTime() + data.days * 24 * 60 * 60 * 1000);
    const { error } = await supabase
      .from("workspaces")
      .update({ trial_ends_at: next.toISOString(), status: "trial" })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    await audit(context, "admin.workspace.trial_extended", data.workspaceId, {
      days: data.days,
      trial_ends_at: next.toISOString(),
    });
    return { trialEndsAt: next.toISOString() };
  });

/** Reset onboarding progress. */
export const resetCustomerOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);
    const { error } = await supabase
      .from("workspaces")
      .update({ setup_step: 0, setup_completed_at: null })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    await audit(context, "admin.workspace.onboarding_reset", data.workspaceId, {});
    return { ok: true as const };
  });

/** Force a workspace slug/name rename. */
export const renameCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: data.name })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    await audit(context, "admin.workspace.renamed", data.workspaceId, { name: data.name });
    return { ok: true as const };
  });

/** Log an admin note against the workspace (persisted as an audit entry). */
export const logCustomerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        note: z.string().trim().min(1).max(4000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);
    await audit(context, "admin.workspace.note", data.workspaceId, { note: data.note });
    return { ok: true as const };
  });
