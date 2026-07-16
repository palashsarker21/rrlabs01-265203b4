/**
 * Queue Manager — server functions.
 *
 * Enterprise job queue visibility, retry orchestration, and Dead Letter Queue
 * management. All entrypoints are super-admin gated; every mutation writes an
 * immutable audit log entry.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "dlq",
  "cancelled",
] as const;
export type JobStatus = (typeof STATUSES)[number];
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JobRow = {
  id: string;
  queue: string;
  job_type: string;
  status: JobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  workspace_id: string | null;
  scheduled_for: string;
  next_retry_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  moved_to_dlq_at: string | null;
  payload: JsonValue;
  created_at: string;
  updated_at: string;
};

export type QueueStat = { queue: string; status: JobStatus; count: number };

async function assertSuperAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (
      fn: "is_super_admin",
      args: { _user_id: string },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await sb.rpc("is_super_admin", { _user_id: context.userId });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

async function audit(
  context: { userId: string; claims: unknown },
  action: string,
  details: Record<string, unknown>,
  targetId?: string,
) {
  const { writeAuditLog } = await import("@/lib/audit.server");
  await writeAuditLog({
    actorId: context.userId,
    actorEmail: (context.claims as { email?: string })?.email ?? null,
    action,
    targetType: "job_queue",
    targetId: targetId ?? null,
    details,
  });
}

const listSchema = z
  .object({
    queue: z.string().max(64).optional(),
    status: z.enum(STATUSES).optional(),
    workspaceId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(1000).default(200),
  })
  .default({ limit: 200 });

export const listAdminJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => listSchema.parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<JobRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("job_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.queue) q = q.eq("queue", data.queue);
    if (data.status) q = q.eq("status", data.status);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as JobRow[];
  });

export const getQueueStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QueueStat[]> => {
    await assertSuperAdmin(context);
    const sb = context.supabase as unknown as {
      rpc: (
        fn: "admin_job_queue_stats",
      ) => Promise<{ data: unknown; error: unknown }>;
    };
    const { data, error } = await sb.rpc("admin_job_queue_stats");
    if (error) throw new Error((error as Error).message ?? "Stats failed.");
    return ((data as unknown[]) ?? []).map((r) => {
      const row = r as { queue: string; status: JobStatus; count: number | string };
      return { queue: row.queue, status: row.status, count: Number(row.count) };
    });
  });

/** Retry a single job — reset to pending, clear error, schedule immediately. */
export const retryJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("job_queue")
      .update({
        status: "pending",
        last_error: null,
        next_retry_at: null,
        started_at: null,
        completed_at: null,
        moved_to_dlq_at: null,
        scheduled_for: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "admin.queue.job_retried", {}, data.id);
    return { ok: true as const };
  });

/** Move a job to the Dead Letter Queue. */
export const moveJobToDlq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(2000).optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("job_queue")
      .update({
        status: "dlq",
        moved_to_dlq_at: new Date().toISOString(),
        last_error: data.reason ?? "Manually moved to DLQ",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "admin.queue.job_dlq", { reason: data.reason ?? null }, data.id);
    return { ok: true as const };
  });

/** Cancel a pending/processing job. */
export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("job_queue")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .in("status", ["pending", "processing", "failed"]);
    if (error) throw new Error(error.message);
    await audit(context, "admin.queue.job_cancelled", {}, data.id);
    return { ok: true as const };
  });

/** Delete a job permanently. */
export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("job_queue").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "admin.queue.job_deleted", {}, data.id);
    return { ok: true as const };
  });

/** Bulk retry every failed job (optionally scoped to a queue). */
export const bulkRetryFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ queue: z.string().max(64).optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("job_queue")
      .update({
        status: "pending",
        last_error: null,
        next_retry_at: null,
        scheduled_for: new Date().toISOString(),
      })
      .eq("status", "failed");
    if (data.queue) q = q.eq("queue", data.queue);
    const { data: rows, error } = await q.select("id");
    const count = rows?.length ?? 0;
    if (error) throw new Error(error.message);
    await audit(context, "admin.queue.bulk_retry", {
      queue: data.queue ?? null,
      count: count ?? 0,
    });
    return { ok: true as const, count: count ?? 0 };
  });

/** Purge all jobs in the DLQ (optionally scoped to a queue). Irreversible. */
export const purgeDlq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ queue: z.string().max(64).optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("job_queue").delete().eq("status", "dlq");
    if (data.queue) q = q.eq("queue", data.queue);
    const { data: rows, error } = await q.select("id");
    const count = rows?.length ?? 0;
    if (error) throw new Error(error.message);
    await audit(context, "admin.queue.dlq_purged", {
      queue: data.queue ?? null,
      count: count ?? 0,
    });
    return { ok: true as const, count: count ?? 0 };
  });
