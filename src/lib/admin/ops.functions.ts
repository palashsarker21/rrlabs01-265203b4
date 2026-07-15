/**
 * Consolidated Super Admin operations server functions.
 *
 * Every function requires an authenticated request AND that the caller is a
 * super admin (checked via `public.is_super_admin`). Reads use the caller's
 * RLS-scoped supabase client where policies already allow super_admin;
 * privileged writes escalate to `supabaseAdmin` inside the handler.
 *
 * All mutations write to `audit_logs` for compliance traceability.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (fn: "is_super_admin", args: { _user_id: string }) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await sb.rpc("is_super_admin", { _user_id: context.userId });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

async function audit(
  context: { userId: string; claims: unknown },
  action: string,
  details: Record<string, unknown>,
  target?: { type: string; id: string; workspaceId?: string | null },
) {
  const { writeAuditLog } = await import("../audit.server");
  await writeAuditLog({
    workspaceId: target?.workspaceId ?? null,
    actorId: context.userId,
    actorEmail: (context.claims as { email?: string })?.email ?? null,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    details,
  });
}

// ---------- USERS & ROLES ----------

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role as string);
      byUser.set(r.user_id, list);
    }
    return (profiles ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["super_admin", "admin", "user"]),
        grant: z.boolean(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    await audit(context, `admin.user.role_${data.grant ? "granted" : "revoked"}`, {
      role: data.role,
    }, { type: "user", id: data.userId });
    return { ok: true as const };
  });

// ---------- SUBSCRIPTIONS ----------

export const listAdminSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select(
        "id, status, ls_subscription_id, renews_at, ends_at, cancelled_at, card_brand, card_last_four, created_at, workspace:workspaces(id, name, slug), plan:plans(code, name, price_cents, currency, interval)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- WEBHOOK MONITOR ----------

export const listAdminWebhookLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ limit: z.number().int().min(1).max(1000).default(200) }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("webhook_logs")
      .select(
        "id, provider_code, event_type, signature_valid, status_code, error, attempt_count, received_at, processed_at, workspace_id, integration_id",
      )
      .order("received_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- INTEGRATIONS ----------

export const listAdminIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select(
        "id, workspace_id, provider, kind, status, last_verified_at, verification_status, last_error, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const forceDisconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ integrationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integrations")
      .update({ status: "disconnected" })
      .eq("id", data.integrationId);
    if (error) throw new Error(error.message);
    await audit(context, "admin.integration.force_disconnected", {}, {
      type: "integration",
      id: data.integrationId,
    });
    return { ok: true as const };
  });

// ---------- RECOVERY ----------

export const listAdminRecoveryEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("recovery_events")
      .select(
        "id, workspace_id, status, amount_cents, currency, provider, external_object_id, failure_message, failure_category, attempts_count, created_at, recovered_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- NOTIFICATIONS (EMAIL + WHATSAPP QUEUES) ----------

export const listAdminNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ channel: z.enum(["email", "whatsapp", "sms", "all"]).default("all") }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    let q = context.supabase
      .from("notification_logs")
      .select("id, workspace_id, kind, channel, recipient, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.channel !== "all") q = q.eq("channel", data.channel);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- BILLING EVENTS ----------

export const listAdminBillingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("billing_events")
      .select("id, event_id, event_name, subscription_id, processed_at, error, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- SUPPORT / CONTACT LEADS ----------

export const listAdminContactLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("contact_leads")
      .select("id, name, email, company, role, seats, arr_range, use_case, plan_code, source, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- SYSTEM HEALTH ----------

export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = Date.now();
    const { error: dbErr } = await supabaseAdmin
      .from("workspaces")
      .select("id", { head: true, count: "exact" });
    const dbLatency = Date.now() - start;
    const { data: providers } = await supabaseAdmin
      .from("provider_status")
      .select("integration_id, verification_status, last_delivery_at, last_success_at, last_error, retry_count")
      .limit(50);
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: webhookErrors } = await supabaseAdmin
      .from("webhook_logs")
      .select("id", { head: true, count: "exact" })
      .not("error", "is", null)
      .gte("received_at", oneHourAgo);
    const { count: notifFailed } = await supabaseAdmin
      .from("notification_logs")
      .select("id", { head: true, count: "exact" })
      .eq("status", "failed")
      .gte("created_at", oneHourAgo);
    return {
      database: { ok: !dbErr, latencyMs: dbLatency },
      providers: providers ?? [],
      last1h: {
        webhookErrors: webhookErrors ?? 0,
        notificationFailures: notifFailed ?? 0,
      },
      timestamp: new Date().toISOString(),
    };
  });

// ---------- GLOBAL SETTINGS ----------

export const listAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_settings")
      .select("key, value, description, updated_at")
      .order("key", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setAdminSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ key: z.string().min(1).max(100), value: z.unknown() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_settings")
      .upsert(
        { key: data.key, value: data.value as never, updated_by: context.userId },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    await audit(context, "admin.settings.updated", { key: data.key }, {
      type: "setting",
      id: data.key,
    });
    return { ok: true as const };
  });

// ---------- MAINTENANCE ----------

export const expireTrialsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { data, error } = await context.supabase.rpc("expire_trial_workspaces");
    if (error) throw new Error(error.message);
    await audit(context, "admin.maintenance.expire_trials", { affected: data ?? 0 });
    return { affected: (data as number) ?? 0 };
  });

// ---------- BLOG MODERATION ----------

export const listAdminBlogPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, status, published_at, updated_at, author_id, category_id")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
