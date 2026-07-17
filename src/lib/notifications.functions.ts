/**
 * In-app alerts + notification preferences.
 * Alerts are created by DB triggers on failed recovery attempts,
 * integration errors, webhook issues, and workspace activation changes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ALERT_CATEGORIES = [
  "recovery_failure",
  "webhook_issue",
  "activation_status",
  "integration_error",
  "system",
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ["open", "acknowledged", "dismissed"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        status: z.enum(ALERT_STATUSES).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("alerts")
      .select(
        "id, category, severity, status, title, message, entity, entity_id, payload, created_at, updated_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const { count: openCount } = await context.supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", data.workspaceId)
      .eq("status", "open");

    return { alerts: rows ?? [], openCount: openCount ?? 0 };
  });

export const updateAlertStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        alertId: z.string().uuid(),
        status: z.enum(["acknowledged", "dismissed", "open"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({
        status: data.status,
        acknowledged_by: data.status === "acknowledged" ? context.userId : null,
        acknowledged_at: data.status === "acknowledged" ? new Date().toISOString() : null,
      })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkDismissAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ status: "dismissed" })
      .eq("workspace_id", data.workspaceId)
      .eq("status", "open");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("notification_preferences")
      .select("id, category, in_app, email, min_severity")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    const byCat = new Map((rows ?? []).map((r) => [r.category, r]));
    return ALERT_CATEGORIES.map(
      (cat) =>
        byCat.get(cat) ?? {
          id: null,
          category: cat,
          in_app: true,
          email: true,
          min_severity: "warning" as AlertSeverity,
        },
    );
  });

export const upsertNotificationPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        category: z.enum(ALERT_CATEGORIES),
        in_app: z.boolean(),
        email: z.boolean(),
        min_severity: z.enum(ALERT_SEVERITIES),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert(
        {
          workspace_id: data.workspaceId,
          user_id: context.userId,
          category: data.category,
          in_app: data.in_app,
          email: data.email,
          min_severity: data.min_severity,
        },
        { onConflict: "workspace_id,user_id,category" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
