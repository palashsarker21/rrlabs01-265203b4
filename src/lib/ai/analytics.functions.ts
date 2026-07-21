import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Not authorized");
}

const FilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  task: z.string().optional(),
  workspaceId: z.string().uuid().optional(),
});

export interface AiAnalyticsSummary {
  totals: {
    requests: number;
    success: number;
    failure: number;
    cached: number;
    fallback: number;
    retries: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    cache_hit_rate: number;
    success_rate: number;
  };
  timeseries: Array<{
    bucket: string;
    requests: number;
    success: number;
    failure: number;
    cached: number;
    cost_usd: number;
    avg_latency_ms: number;
  }>;
  byProvider: Array<{
    provider: string;
    requests: number;
    success: number;
    failure: number;
    cost_usd: number;
    avg_latency_ms: number;
  }>;
  byModel: Array<{
    model: string;
    provider: string;
    requests: number;
    success: number;
    failure: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    avg_latency_ms: number;
  }>;
  byTask: Array<{
    task: string;
    requests: number;
    cost_usd: number;
    cache_hit_rate: number;
  }>;
  facets: {
    providers: string[];
    models: string[];
    tasks: string[];
  };
}

interface Row {
  created_at: string;
  provider_slug: string;
  model_id: string;
  task: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | string | null;
  latency_ms: number | null;
  cached: boolean | null;
  fallback_used: boolean | null;
  attempt: number | null;
}

function pct(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}
function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

export const getAiAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FilterSchema.parse(input))
  .handler(async ({ data, context }): Promise<AiAnalyticsSummary> => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const to = data.to ? new Date(data.to) : new Date();
    const from = data.from ? new Date(data.from) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    let q = supabaseAdmin
      .from("ai_requests")
      .select(
        "created_at, provider_slug, model_id, task, status, input_tokens, output_tokens, cost_usd, latency_ms, cached, fallback_used, attempt",
      )
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: true })
      .limit(50000);

    if (data.provider) q = q.eq("provider_slug", data.provider);
    if (data.model) q = q.eq("model_id", data.model);
    if (data.task) q = q.eq("task", data.task);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Row[];

    // Facets — unfiltered per dim from same window
    const { data: facetRows } = await supabaseAdmin
      .from("ai_requests")
      .select("provider_slug, model_id, task")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .limit(50000);
    const providers = new Set<string>();
    const models = new Set<string>();
    const tasks = new Set<string>();
    for (const r of (facetRows ?? []) as Array<{
      provider_slug: string;
      model_id: string;
      task: string;
    }>) {
      if (r.provider_slug) providers.add(r.provider_slug);
      if (r.model_id) models.add(r.model_id);
      if (r.task) tasks.add(r.task);
    }

    // Aggregate
    let requests = 0,
      success = 0,
      failure = 0,
      cached = 0,
      fallback = 0,
      retries = 0,
      inTok = 0,
      outTok = 0,
      cost = 0,
      latencySum = 0,
      latencyCount = 0;
    const latencies: number[] = [];

    const spanMs = to.getTime() - from.getTime();
    const bucketMs = spanMs > 3 * 24 * 60 * 60 * 1000 ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const buckets = new Map<
      string,
      {
        requests: number;
        success: number;
        failure: number;
        cached: number;
        cost_usd: number;
        latSum: number;
        latN: number;
      }
    >();
    const byProv = new Map<
      string,
      {
        requests: number;
        success: number;
        failure: number;
        cost_usd: number;
        latSum: number;
        latN: number;
      }
    >();
    const byMod = new Map<
      string,
      {
        provider: string;
        requests: number;
        success: number;
        failure: number;
        inTok: number;
        outTok: number;
        cost_usd: number;
        latSum: number;
        latN: number;
      }
    >();
    const byTsk = new Map<string, { requests: number; cost_usd: number; cached: number }>();

    for (const r of list) {
      requests++;
      const c = Number(r.cost_usd ?? 0);
      cost += c;
      inTok += r.input_tokens ?? 0;
      outTok += r.output_tokens ?? 0;
      if (r.cached) cached++;
      if (r.fallback_used) fallback++;
      if ((r.attempt ?? 1) > 1) retries++;
      const isSuccess = r.status === "ok" || r.status === "cached" || r.status === "fallback";
      if (isSuccess) success++;
      else failure++;
      const lat = r.latency_ms ?? 0;
      if (lat > 0) {
        latencies.push(lat);
        latencySum += lat;
        latencyCount++;
      }

      // bucket
      const ts = new Date(r.created_at).getTime();
      const bkt = new Date(Math.floor(ts / bucketMs) * bucketMs).toISOString();
      const b = buckets.get(bkt) ?? {
        requests: 0,
        success: 0,
        failure: 0,
        cached: 0,
        cost_usd: 0,
        latSum: 0,
        latN: 0,
      };
      b.requests++;
      if (isSuccess) b.success++;
      else b.failure++;
      if (r.cached) b.cached++;
      b.cost_usd += c;
      if (lat > 0) {
        b.latSum += lat;
        b.latN++;
      }
      buckets.set(bkt, b);

      const p = byProv.get(r.provider_slug) ?? {
        requests: 0,
        success: 0,
        failure: 0,
        cost_usd: 0,
        latSum: 0,
        latN: 0,
      };
      p.requests++;
      if (isSuccess) p.success++;
      else p.failure++;
      p.cost_usd += c;
      if (lat > 0) {
        p.latSum += lat;
        p.latN++;
      }
      byProv.set(r.provider_slug, p);

      const mKey = r.model_id;
      const m = byMod.get(mKey) ?? {
        provider: r.provider_slug,
        requests: 0,
        success: 0,
        failure: 0,
        inTok: 0,
        outTok: 0,
        cost_usd: 0,
        latSum: 0,
        latN: 0,
      };
      m.requests++;
      if (isSuccess) m.success++;
      else m.failure++;
      m.inTok += r.input_tokens ?? 0;
      m.outTok += r.output_tokens ?? 0;
      m.cost_usd += c;
      if (lat > 0) {
        m.latSum += lat;
        m.latN++;
      }
      byMod.set(mKey, m);

      const t = byTsk.get(r.task) ?? { requests: 0, cost_usd: 0, cached: 0 };
      t.requests++;
      t.cost_usd += c;
      if (r.cached) t.cached++;
      byTsk.set(r.task, t);
    }

    latencies.sort((a, b) => a - b);

    return {
      totals: {
        requests,
        success,
        failure,
        cached,
        fallback,
        retries,
        input_tokens: inTok,
        output_tokens: outTok,
        cost_usd: cost,
        avg_latency_ms: latencyCount ? Math.round(latencySum / latencyCount) : 0,
        p95_latency_ms: Math.round(percentile(latencies, 95)),
        cache_hit_rate: pct(cached, requests),
        success_rate: pct(success, requests),
      },
      timeseries: Array.from(buckets.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([bucket, v]) => ({
          bucket,
          requests: v.requests,
          success: v.success,
          failure: v.failure,
          cached: v.cached,
          cost_usd: Number(v.cost_usd.toFixed(6)),
          avg_latency_ms: v.latN ? Math.round(v.latSum / v.latN) : 0,
        })),
      byProvider: Array.from(byProv.entries())
        .map(([provider, v]) => ({
          provider,
          requests: v.requests,
          success: v.success,
          failure: v.failure,
          cost_usd: Number(v.cost_usd.toFixed(6)),
          avg_latency_ms: v.latN ? Math.round(v.latSum / v.latN) : 0,
        }))
        .sort((a, b) => b.requests - a.requests),
      byModel: Array.from(byMod.entries())
        .map(([model, v]) => ({
          model,
          provider: v.provider,
          requests: v.requests,
          success: v.success,
          failure: v.failure,
          input_tokens: v.inTok,
          output_tokens: v.outTok,
          cost_usd: Number(v.cost_usd.toFixed(6)),
          avg_latency_ms: v.latN ? Math.round(v.latSum / v.latN) : 0,
        }))
        .sort((a, b) => b.requests - a.requests),
      byTask: Array.from(byTsk.entries())
        .map(([task, v]) => ({
          task,
          requests: v.requests,
          cost_usd: Number(v.cost_usd.toFixed(6)),
          cache_hit_rate: pct(v.cached, v.requests),
        }))
        .sort((a, b) => b.requests - a.requests),
      facets: {
        providers: Array.from(providers).sort(),
        models: Array.from(models).sort(),
        tasks: Array.from(tasks).sort(),
      },
    };
  });
