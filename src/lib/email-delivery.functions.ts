/**
 * Admin delivery dashboard server functions.
 *
 * - Super-admin gated.
 * - Lists email_logs (queued/retried/failed/sent/skipped) with filters.
 * - Drills into a single delivery, showing attempts and provider events.
 * - Replay control resends an existing log's template to its recipient,
 *   reusing stored metadata.data when present, otherwise falling back to
 *   TEMPLATE_SAMPLES. A replay creates a new email_logs row tagged
 *   `admin_replay` with a `replay_of` reference to the original id.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REPLAY_TAG = "admin_replay";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const ListInput = z.object({
  status: z
    .enum(["all", "queued", "sent", "failed", "skipped", "retried"])
    .optional()
    .default("all"),
  template: z.string().trim().optional().default(""),
  recipient: z.string().trim().optional().default(""),
  messageId: z.string().trim().optional().default(""),
  workspaceId: z.string().uuid().optional().nullable(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const listDeliveriesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ListInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("email_logs")
      .select(
        "id,workspace_id,template,recipient,subject,status,provider,provider_message_id,attempts,last_error,metadata,created_at,updated_at,sent_at,failed_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.status === "retried") {
      q = q.gte("attempts", 2);
    } else if (data.status !== "all") {
      q = q.eq("status", data.status);
    }
    if (data.template) q = q.eq("template", data.template);
    if (data.recipient) q = q.ilike("recipient", `%${data.recipient}%`);
    if (data.messageId) q = q.eq("provider_message_id", data.messageId);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    // Aggregate counters for the filter chips (ignoring status/messageId filter).
    const baseFilters = supabaseAdmin.from("email_logs").select("status,attempts", { head: false });
    let counterQ = baseFilters;
    if (data.template) counterQ = counterQ.eq("template", data.template);
    if (data.recipient) counterQ = counterQ.ilike("recipient", `%${data.recipient}%`);
    if (data.workspaceId) counterQ = counterQ.eq("workspace_id", data.workspaceId);
    const { data: counterRows } = await counterQ.limit(2000);
    const counts = { total: 0, queued: 0, sent: 0, failed: 0, skipped: 0, retried: 0 };
    for (const r of counterRows ?? []) {
      counts.total += 1;
      const s = String(r.status);
      if (s in counts) (counts as Record<string, number>)[s] += 1;
      if ((r.attempts ?? 0) >= 2) counts.retried += 1;
    }

    return { rows: rows ?? [], total: count ?? 0, counts };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const getDeliveryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: log, error } = await supabaseAdmin
      .from("email_logs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!log) throw new Error("Delivery not found");

    const { data: events } = await supabaseAdmin
      .from("email_events")
      .select("id,event_type,payload,created_at,provider_message_id")
      .eq("email_log_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);

    // Related replays / replay origin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (log.metadata ?? {}) as Record<string, any>;
    const replayOf = typeof meta.replay_of === "string" ? meta.replay_of : null;
    const { data: replays } = await supabaseAdmin
      .from("email_logs")
      .select("id,status,attempts,created_at,provider_message_id")
      .contains("metadata", { replay_of: data.id })
      .order("created_at", { ascending: false })
      .limit(20);

    return { log, events: events ?? [], replays: replays ?? [], replayOf };
  });

async function replayLogById(
  logId: string,
  actorUserId: string,
): Promise<{ result: Awaited<ReturnType<typeof import("./email/service.server").sendEmail>>; durationMs: number; replayOf: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: log, error } = await supabaseAdmin
    .from("email_logs")
    .select("id,template,recipient,workspace_id,metadata")
    .eq("id", logId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!log) throw new Error("Delivery not found");

  const { isTemplateName } = await import("./email/templates/registry");
  if (!isTemplateName(log.template)) {
    throw new Error(`Template "${log.template}" is no longer available.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (log.metadata ?? {}) as Record<string, any>;
  let payload = meta.data;
  if (!payload || typeof payload !== "object") {
    const { TEMPLATE_SAMPLES } = await import("./email/template-samples");
    payload = TEMPLATE_SAMPLES[log.template]?.data ?? {};
  }

  const { sendEmail } = await import("./email/service.server");
  const started = Date.now();
  const result = await sendEmail<Record<string, unknown>>({
    template: log.template as never,
    to: log.recipient,
    data: payload as Record<string, unknown>,
    workspaceId: log.workspace_id,
    metadata: {
      [REPLAY_TAG]: true,
      replay_of: logId,
      replayed_by: actorUserId,
      data: payload,
    },
  });
  const durationMs = Date.now() - started;
  return { result, durationMs, replayOf: logId };
}

export const replayDeliveryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    return replayLogById(data.id, context.userId);
  });

const BulkReplayInput = z.object({
  ids: z.array(z.string().uuid()).max(50).optional().default([]),
  messageIds: z.array(z.string().trim().min(1)).max(50).optional().default([]),
});

export const bulkReplayDeliveriesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => BulkReplayInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve any provided provider_message_id values to log IDs.
    const resolved = new Map<string, string>(); // key -> logId
    for (const id of data.ids) resolved.set(id, id);
    if (data.messageIds.length > 0) {
      const { data: rows, error } = await supabaseAdmin
        .from("email_logs")
        .select("id,provider_message_id")
        .in("provider_message_id", data.messageIds);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        if (r.provider_message_id) resolved.set(String(r.provider_message_id), r.id);
      }
      for (const mid of data.messageIds) {
        if (!resolved.has(mid)) resolved.set(mid, "__notfound__");
      }
    }

    if (resolved.size === 0) throw new Error("Provide at least one delivery to replay.");
    if (resolved.size > 50) throw new Error("Bulk replay is capped at 50 items per request.");

    type Item = {
      input: string;
      logId: string | null;
      ok: boolean;
      newLogId?: string;
      durationMs?: number;
      error?: string;
    };
    const items: Item[] = [];

    for (const [input, logId] of resolved.entries()) {
      if (logId === "__notfound__") {
        items.push({ input, logId: null, ok: false, error: "No delivery found for that message ID." });
        continue;
      }
      try {
        const r = await replayLogById(logId, context.userId);
        items.push({
          input,
          logId,
          ok: Boolean(r.result.ok),
          newLogId: r.result.ok ? r.result.id : undefined,
          durationMs: r.durationMs,
          error: r.result.ok ? undefined : r.result.error,
        });
      } catch (err) {
        items.push({
          input,
          logId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const succeeded = items.filter((i) => i.ok).length;
    const failed = items.length - succeeded;
    return { total: items.length, succeeded, failed, items };
  });

const ResolveBulkInput = z.object({
  ids: z.array(z.string().uuid()).max(50).optional().default([]),
  messageIds: z.array(z.string().trim().min(1)).max(50).optional().default([]),
});

/**
 * Resolve a bulk-replay selection to concrete log rows with recipient/template
 * metadata, WITHOUT executing the replay. The client uses this to drive a
 * per-item progress indicator, then calls replayDeliveryFn one row at a time.
 */
export const resolveBulkReplayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ResolveBulkInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type Resolved = {
      input: string;
      logId: string | null;
      recipient: string | null;
      template: string | null;
      error?: string;
    };
    const items: Resolved[] = [];
    const seen = new Set<string>();

    const logIds = [...new Set(data.ids)];
    if (logIds.length > 0) {
      const { data: rows, error } = await supabaseAdmin
        .from("email_logs")
        .select("id,recipient,template")
        .in("id", logIds);
      if (error) throw new Error(error.message);
      const byId = new Map((rows ?? []).map((r) => [r.id, r]));
      for (const id of logIds) {
        const r = byId.get(id);
        if (r) {
          items.push({ input: id, logId: r.id, recipient: r.recipient, template: r.template });
        } else {
          items.push({ input: id, logId: null, recipient: null, template: null, error: "Log not found." });
        }
        seen.add(id);
      }
    }

    const mids = [...new Set(data.messageIds)];
    if (mids.length > 0) {
      const { data: rows, error } = await supabaseAdmin
        .from("email_logs")
        .select("id,recipient,template,provider_message_id")
        .in("provider_message_id", mids);
      if (error) throw new Error(error.message);
      const byMid = new Map(
        (rows ?? []).map((r) => [String(r.provider_message_id), r]),
      );
      for (const mid of mids) {
        const r = byMid.get(mid);
        if (r && !seen.has(r.id)) {
          items.push({ input: mid, logId: r.id, recipient: r.recipient, template: r.template });
          seen.add(r.id);
        } else if (!r) {
          items.push({
            input: mid,
            logId: null,
            recipient: null,
            template: null,
            error: "No delivery found for that message ID.",
          });
        }
      }
    }

    if (items.length > 50) {
      throw new Error("Bulk replay is capped at 50 items per request.");
    }
    return { items };
  });




export const listTemplateOptionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("email_logs")
      .select("template")
      .order("template", { ascending: true })
      .limit(1000);
    const set = new Set<string>();
    for (const r of data ?? []) if (r.template) set.add(String(r.template));
    return { templates: [...set].sort() };
  });
