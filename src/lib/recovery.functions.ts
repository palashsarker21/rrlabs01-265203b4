import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workspaceIdSchema = z.object({ workspaceId: z.string().uuid() });

/** Aggregate recovery metrics for a workspace. */
export const getRecoveryStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => workspaceIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("recovery_events")
      .select("status, amount_cents, currency")
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);

    let total = 0;
    let recovered = 0;
    let inFlight = 0;
    let recoveredAmount = 0;
    let atRiskAmount = 0;
    let currency: string | null = null;
    for (const r of rows ?? []) {
      total++;
      if (!currency && r.currency) currency = r.currency;
      if (r.status === "recovered") {
        recovered++;
        recoveredAmount += r.amount_cents ?? 0;
      } else if (r.status === "new" || r.status === "analyzing" || r.status === "recovering") {
        inFlight++;
        atRiskAmount += r.amount_cents ?? 0;
      }
    }
    return {
      total,
      recovered,
      inFlight,
      recoveryRate: total > 0 ? recovered / total : 0,
      recoveredAmountCents: recoveredAmount,
      atRiskAmountCents: atRiskAmount,
      currency,
    };
  });

/** Paginated list of recovery events for a workspace. */
export const listRecoveryEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ workspaceId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(50) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("recovery_events")
      .select(
        `id, status, amount_cents, currency, failure_code, failure_message, failure_category,
         next_action, ai_summary, attempts_count, created_at, recovered_at,
         customer:customers ( id, email, name, phone )`,
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Attempts for a single recovery event, ordered chronologically. */
export const listRecoveryAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ eventId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("recovery_attempts")
      .select(
        "id, channel, status, to_address, subject, body_text, error, sent_at, delivered_at, created_at, step",
      )
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Manually trigger another recovery pass for an event. */
export const retryRecoveryEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ eventId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("recovery_events")
      .select("id, workspace_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Event not found.");

    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: row.workspace_id,
      _user_id: userId,
    });
    if (!canManage) throw new Error("Not permitted.");

    const { runRecoveryForEvent } = await import("./recovery/engine.server");
    await runRecoveryForEvent({ eventId: row.id });
    return { ok: true as const };
  });

/** Mark an event as abandoned — stop the engine for this failure. */
export const abandonRecoveryEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ eventId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("recovery_events")
      .select("id, workspace_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Event not found.");

    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: row.workspace_id,
      _user_id: userId,
    });
    if (!canManage) throw new Error("Not permitted.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("recovery_events")
      .update({ status: "abandoned" })
      .eq("id", row.id);
    return { ok: true as const };
  });
