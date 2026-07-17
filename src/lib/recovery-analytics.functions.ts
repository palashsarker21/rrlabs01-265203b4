import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rangeSchema = z.object({
  workspaceId: z.string().uuid(),
  days: z.number().int().min(1).max(365).default(30),
});

export type RecoveryAnalyticsPoint = {
  date: string;
  events: number;
  recovered: number;
  atRiskCents: number;
  recoveredCents: number;
};

export type RecoveryAttemptsPoint = {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
};

export type ChannelBreakdown = {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
};

export type FailureCategory = { category: string; count: number; amountCents: number };

export type RecoveryAnalytics = {
  currency: string | null;
  totalEvents: number;
  totalRecovered: number;
  totalInFlight: number;
  totalAbandoned: number;
  recoveryRate: number;
  recoveredCents: number;
  atRiskCents: number;
  attemptsSent: number;
  attemptsDelivered: number;
  attemptsFailed: number;
  avgAttemptsPerRecovery: number;
  timeSeries: RecoveryAnalyticsPoint[];
  attempts: RecoveryAttemptsPoint[];
  channels: ChannelBreakdown[];
  failureCategories: FailureCategory[];
};

function isoDay(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toISOString().slice(0, 10);
}

export const getRecoveryAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => rangeSchema.parse(raw))
  .handler(async ({ data, context }): Promise<RecoveryAnalytics> => {
    const { supabase } = context;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (data.days - 1));
    const sinceIso = since.toISOString();

    const eventsQ = supabase
      .from("recovery_events")
      .select(
        "status, amount_cents, currency, failure_category, attempts_count, created_at, recovered_at",
      )
      .eq("workspace_id", data.workspaceId)
      .gte("created_at", sinceIso);

    const attemptsQ = supabase
      .from("recovery_attempts")
      .select("channel, status, sent_at, delivered_at, created_at")
      .eq("workspace_id", data.workspaceId)
      .gte("created_at", sinceIso);

    const [{ data: events, error: eErr }, { data: attempts, error: aErr }] = await Promise.all([
      eventsQ,
      attemptsQ,
    ]);
    if (eErr) throw new Error(eErr.message);
    if (aErr) throw new Error(aErr.message);

    // Build day buckets
    const dayKeys: string[] = [];
    for (let i = 0; i < data.days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      dayKeys.push(isoDay(d));
    }
    const eventsByDay = new Map<string, RecoveryAnalyticsPoint>();
    const attemptsByDay = new Map<string, RecoveryAttemptsPoint>();
    for (const k of dayKeys) {
      eventsByDay.set(k, { date: k, events: 0, recovered: 0, atRiskCents: 0, recoveredCents: 0 });
      attemptsByDay.set(k, { date: k, sent: 0, delivered: 0, failed: 0 });
    }

    let currency: string | null = null;
    let totalRecovered = 0;
    let totalInFlight = 0;
    let totalAbandoned = 0;
    let recoveredCents = 0;
    let atRiskCents = 0;
    let sumAttemptsForRecovered = 0;
    const failureBuckets = new Map<string, FailureCategory>();

    for (const r of events ?? []) {
      if (!currency && r.currency) currency = r.currency;
      const dayKey = isoDay(r.created_at);
      const bucket = eventsByDay.get(dayKey);
      if (bucket) {
        bucket.events += 1;
        if (r.status === "recovered") {
          bucket.recovered += 1;
          bucket.recoveredCents += r.amount_cents ?? 0;
        } else if (
          r.status === "new" ||
          r.status === "analyzing" ||
          r.status === "recovering"
        ) {
          bucket.atRiskCents += r.amount_cents ?? 0;
        }
      }
      if (r.status === "recovered") {
        totalRecovered += 1;
        recoveredCents += r.amount_cents ?? 0;
        sumAttemptsForRecovered += r.attempts_count ?? 0;
      } else if (r.status === "abandoned") {
        totalAbandoned += 1;
      } else if (
        r.status === "new" ||
        r.status === "analyzing" ||
        r.status === "recovering"
      ) {
        totalInFlight += 1;
        atRiskCents += r.amount_cents ?? 0;
      }
      const cat = (r.failure_category as string | null) ?? "unknown";
      const fb = failureBuckets.get(cat) ?? { category: cat, count: 0, amountCents: 0 };
      fb.count += 1;
      fb.amountCents += r.amount_cents ?? 0;
      failureBuckets.set(cat, fb);
    }

    let attemptsSent = 0;
    let attemptsDelivered = 0;
    let attemptsFailed = 0;
    const channels = new Map<string, ChannelBreakdown>();
    for (const a of attempts ?? []) {
      const dayKey = isoDay(a.created_at);
      const bucket = attemptsByDay.get(dayKey);
      const ch = (a.channel as string) ?? "unknown";
      const status = a.status as string;
      const cbucket = channels.get(ch) ?? { channel: ch, sent: 0, delivered: 0, failed: 0 };
      if (status === "sent" || status === "delivered") {
        attemptsSent += 1;
        cbucket.sent += 1;
        if (bucket) bucket.sent += 1;
      }
      if (status === "delivered") {
        attemptsDelivered += 1;
        cbucket.delivered += 1;
        if (bucket) bucket.delivered += 1;
      }
      if (status === "failed" || status === "bounced" || status === "cancelled") {
        attemptsFailed += 1;
        cbucket.failed += 1;
        if (bucket) bucket.failed += 1;
      }
      channels.set(ch, cbucket);
    }

    const totalEvents = (events ?? []).length;
    return {
      currency,
      totalEvents,
      totalRecovered,
      totalInFlight,
      totalAbandoned,
      recoveryRate: totalEvents > 0 ? totalRecovered / totalEvents : 0,
      recoveredCents,
      atRiskCents,
      attemptsSent,
      attemptsDelivered,
      attemptsFailed,
      avgAttemptsPerRecovery:
        totalRecovered > 0 ? sumAttemptsForRecovered / totalRecovered : 0,
      timeSeries: dayKeys.map((k) => eventsByDay.get(k)!),
      attempts: dayKeys.map((k) => attemptsByDay.get(k)!),
      channels: Array.from(channels.values()).sort((a, b) => b.sent - a.sent),
      failureCategories: Array.from(failureBuckets.values()).sort((a, b) => b.count - a.count),
    };
  });
