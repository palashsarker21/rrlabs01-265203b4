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

    const [wsR, membersR, subsR, integrationsR, eventsR, auditR] = await Promise.all([
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
          "id, plan_id, status, current_period_start, current_period_end, cancelled_at, ls_subscription_id",
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
        .select("id, status, amount_cents, currency, created_at", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId),
      supabase
        .from("audit_logs")
        .select("id, action, actor_email, target_type, target_id, details, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (wsR.error) throw new Error(wsR.error.message);
    return {
      workspace: wsR.data,
      members: membersR.data ?? [],
      subscriptions: subsR.data ?? [],
      integrations: integrationsR.data ?? [],
      eventsCount: eventsR.count ?? 0,
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
