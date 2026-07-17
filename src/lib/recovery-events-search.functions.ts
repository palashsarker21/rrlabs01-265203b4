import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filterSchema = z.object({
  workspaceId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  statuses: z.array(z.string()).optional(),
  providers: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  search: z.string().max(200).optional(),
  minAmountCents: z.number().int().min(0).optional(),
  maxAmountCents: z.number().int().min(0).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(200).default(50),
});

export type EventsFilter = z.infer<typeof filterSchema>;

export type RecoveryEventRow = {
  id: string;
  status: string;
  provider: string | null;
  amount_cents: number | null;
  currency: string | null;
  failure_code: string | null;
  failure_message: string | null;
  failure_category: string | null;
  next_action: string | null;
  ai_summary: string | null;
  attempts_count: number;
  created_at: string;
  recovered_at: string | null;
  abandoned_at: string | null;
  external_object_id: string | null;
  object_type: string | null;
  customer: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
  } | null;
};

const SELECT = `id, status, provider, amount_cents, currency, failure_code, failure_message,
  failure_category, next_action, ai_summary, attempts_count, created_at, recovered_at,
  abandoned_at, external_object_id, object_type,
  customer:customers ( id, email, name, phone )`;

export const searchRecoveryEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => filterSchema.parse(raw))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ rows: RecoveryEventRow[]; total: number; page: number; pageSize: number }> => {
      const { supabase } = context;
      const from = (data.page - 1) * data.pageSize;
      const to = from + data.pageSize - 1;

      let q = supabase
        .from("recovery_events")
        .select(SELECT, { count: "exact" })
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false });

      if (data.from) q = q.gte("created_at", data.from);
      if (data.to) q = q.lte("created_at", data.to);
      if (data.statuses?.length) q = q.in("status", data.statuses);
      if (data.providers?.length) q = q.in("provider", data.providers);
      if (typeof data.minAmountCents === "number") q = q.gte("amount_cents", data.minAmountCents);
      if (typeof data.maxAmountCents === "number") q = q.lte("amount_cents", data.maxAmountCents);
      if (data.search) {
        const term = data.search.replace(/[%_]/g, "").trim();
        if (term) {
          q = q.or(
            [
              `failure_message.ilike.%${term}%`,
              `failure_code.ilike.%${term}%`,
              `external_object_id.ilike.%${term}%`,
              `ai_summary.ilike.%${term}%`,
            ].join(","),
          );
        }
      }

      const { data: rows, error, count } = await q.range(from, to);
      if (error) throw new Error(error.message);
      return {
        rows: (rows ?? []) as unknown as RecoveryEventRow[],
        total: count ?? 0,
        page: data.page,
        pageSize: data.pageSize,
      };
    },
  );

export type RecoveryAttemptRow = {
  id: string;
  step: number;
  channel: string;
  status: string;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  error: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

/** Export dataset for the current filters — up to `maxRows`. */
export const exportRecoveryEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    filterSchema
      .omit({ page: true, pageSize: true })
      .extend({ maxRows: z.number().int().min(1).max(10_000).default(5000) })
      .parse(raw),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      events: RecoveryEventRow[];
      attempts: Record<string, RecoveryAttemptRow[]>;
    }> => {
      const { supabase } = context;
      let q = supabase
        .from("recovery_events")
        .select(SELECT)
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(data.maxRows);
      if (data.from) q = q.gte("created_at", data.from);
      if (data.to) q = q.lte("created_at", data.to);
      if (data.statuses?.length) q = q.in("status", data.statuses);
      if (data.providers?.length) q = q.in("provider", data.providers);
      if (typeof data.minAmountCents === "number") q = q.gte("amount_cents", data.minAmountCents);
      if (typeof data.maxAmountCents === "number") q = q.lte("amount_cents", data.maxAmountCents);
      if (data.search) {
        const term = data.search.replace(/[%_]/g, "").trim();
        if (term) {
          q = q.or(
            [
              `failure_message.ilike.%${term}%`,
              `failure_code.ilike.%${term}%`,
              `external_object_id.ilike.%${term}%`,
              `ai_summary.ilike.%${term}%`,
            ].join(","),
          );
        }
      }
      const { data: eventRows, error } = await q;
      if (error) throw new Error(error.message);

      const events = (eventRows ?? []) as unknown as RecoveryEventRow[];
      const ids = events.map((e) => e.id);
      let attempts: RecoveryAttemptRow[] = [];
      if (ids.length) {
        const { data: aRows, error: aErr } = await supabase
          .from("recovery_attempts")
          .select(
            "id, step, channel, status, to_address, subject, body_text, error, scheduled_for, sent_at, delivered_at, created_at, event_id",
          )
          .in("event_id", ids)
          .order("created_at", { ascending: true });
        if (aErr) throw new Error(aErr.message);
        attempts = (aRows ?? []) as unknown as (RecoveryAttemptRow & { event_id: string })[];
      }
      const byEvent: Record<string, RecoveryAttemptRow[]> = {};
      for (const a of attempts as (RecoveryAttemptRow & { event_id: string })[]) {
        (byEvent[a.event_id] ||= []).push(a);
      }
      if (data.channels?.length) {
        const set = new Set(data.channels);
        for (const k of Object.keys(byEvent)) {
          byEvent[k] = byEvent[k].filter((x) => set.has(x.channel));
        }
      }
      return { events, attempts: byEvent };
    },
  );
