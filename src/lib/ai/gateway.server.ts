/**
 * Centralized AI Gateway — task-based routing, multi-model fallback,
 * response caching, cost tracking, and per-workspace governance.
 *
 * Server-only. Never import from browser code.
 *
 * Usage:
 *   import { runAI } from "@/lib/ai/gateway.server";
 *   const res = await runAI({
 *     task: "recovery",
 *     workspaceId,
 *     userId,
 *     system: "You write short recovery messages.",
 *     user: "Customer: ...",
 *     json: false,
 *   });
 *   console.log(res.text, res.model, res.cost_usd);
 */

import { cacheKey, readCache, writeCache } from "./cache.server";

export type AiTier = "primary" | "secondary" | "premium" | "fallback";

export interface RunAIInput {
  task: string;
  workspaceId?: string | null;
  userId?: string | null;
  system?: string;
  user: string;
  json?: boolean;
  /** Force a tier. Default: primary. Auto-falls to secondary/fallback on error. */
  tier?: AiTier;
  temperature?: number;
  max_tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface RunAIResult {
  ok: boolean;
  text: string;
  json?: unknown;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  cached: boolean;
  fallback_used: boolean;
  attempt: number;
  error?: string;
}

interface RouteRow {
  task: string;
  primary_model_id: string | null;
  secondary_model_id: string | null;
  premium_model_id: string | null;
  fallback_model_id: string | null;
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  timeout_ms: number;
  max_retries: number;
  enabled: boolean;
}

interface ModelRow {
  id: string;
  model_id: string;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  supports_json: boolean;
  enabled: boolean;
  provider_slug: string;
  provider_base_url: string;
  provider_secret_env: string;
  provider_enabled: boolean;
}

interface WorkspaceAiSettings {
  ai_enabled: boolean;
  cache_enabled: boolean;
  fallback_enabled: boolean;
  premium_enabled: boolean;
  monthly_budget_usd: number | null;
  monthly_token_limit: number | null;
  default_model: string | null;
  custom_system_prompt: string | null;
}

// ---------------------------------------------------------------------------
// Loaders

async function loadRoute(task: string): Promise<RouteRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ai_routes")
    .select(
      "task, primary_model_id, secondary_model_id, premium_model_id, fallback_model_id, cache_enabled, cache_ttl_seconds, timeout_ms, max_retries, enabled",
    )
    .eq("task", task)
    .maybeSingle();
  return (data as RouteRow | null) ?? null;
}

async function loadModel(id: string | null): Promise<ModelRow | null> {
  if (!id) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ai_models")
    .select(
      `id, model_id, input_price_per_mtok, output_price_per_mtok, supports_json, enabled,
       ai_providers!inner(slug, base_url, secret_env_var, enabled)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const p = (data as unknown as { ai_providers: { slug: string; base_url: string; secret_env_var: string; enabled: boolean } })
    .ai_providers;
  return {
    id: data.id,
    model_id: data.model_id,
    input_price_per_mtok: Number(data.input_price_per_mtok),
    output_price_per_mtok: Number(data.output_price_per_mtok),
    supports_json: data.supports_json,
    enabled: data.enabled,
    provider_slug: p.slug,
    provider_base_url: p.base_url,
    provider_secret_env: p.secret_env_var,
    provider_enabled: p.enabled,
  };
}

async function loadWorkspaceSettings(
  workspaceId: string | null | undefined,
): Promise<WorkspaceAiSettings | null> {
  if (!workspaceId) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("organization_ai_settings")
    .select(
      "ai_enabled, cache_enabled, fallback_enabled, premium_enabled, monthly_budget_usd, monthly_token_limit, default_model, custom_system_prompt",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as WorkspaceAiSettings | null) ?? null;
}

async function killSwitchOn(): Promise<{ killed: boolean; maintenance: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("feature_flags")
    .select("key, enabled")
    .in("key", ["ai_kill_switch", "ai_maintenance_mode"]);
  const rows = data ?? [];
  return {
    killed: rows.some((r) => r.key === "ai_kill_switch" && r.enabled),
    maintenance: rows.some((r) => r.key === "ai_maintenance_mode" && r.enabled),
  };
}

// ---------------------------------------------------------------------------
// Cost + tokens

function estimateTokens(text: string): number {
  // Rough heuristic — 4 chars ≈ 1 token. Only used when provider omits usage.
  return Math.ceil(text.length / 4);
}

function computeCost(m: ModelRow, inTok: number, outTok: number): number {
  return (
    (inTok / 1_000_000) * m.input_price_per_mtok +
    (outTok / 1_000_000) * m.output_price_per_mtok
  );
}

// ---------------------------------------------------------------------------
// Provider call (OpenAI-compatible chat completions)

interface CallResult {
  text: string;
  json?: unknown;
  input_tokens: number;
  output_tokens: number;
}

async function callModel(
  model: ModelRow,
  args: {
    system?: string;
    user: string;
    json: boolean;
    timeout_ms: number;
    temperature?: number;
    max_tokens?: number;
  },
): Promise<CallResult> {
  const key = process.env[model.provider_secret_env];
  if (!key) {
    throw new Error(`Missing secret ${model.provider_secret_env} for provider ${model.provider_slug}`);
  }
  const body: Record<string, unknown> = {
    model: model.model_id,
    messages: [
      ...(args.system ? [{ role: "system", content: args.system }] : []),
      { role: "user", content: args.user },
    ],
  };
  if (args.temperature != null) body.temperature = args.temperature;
  if (args.max_tokens != null) body.max_tokens = args.max_tokens;
  if (args.json && model.supports_json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (model.provider_slug === "lovable" || model.provider_slug === "google") {
    headers["Lovable-API-Key"] = key;
    headers["X-Lovable-AIG-SDK"] = "rrlabs-gateway";
  }
  if (model.provider_slug === "openrouter") {
    headers["HTTP-Referer"] = "https://www.rrlabs.online";
    headers["X-Title"] = "RRLabs";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeout_ms);
  try {
    const res = await fetch(`${model.provider_base_url}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`${model.provider_slug} ${res.status}: ${err.slice(0, 300)}`);
    }
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    const inTok = payload.usage?.prompt_tokens ?? estimateTokens((args.system ?? "") + args.user);
    const outTok = payload.usage?.completion_tokens ?? estimateTokens(text);
    let parsedJson: unknown = undefined;
    if (args.json) {
      try {
        parsedJson = JSON.parse(text);
      } catch {
        parsedJson = undefined;
      }
    }
    return { text, json: parsedJson, input_tokens: inTok, output_tokens: outTok };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Request logging

async function logRequest(row: {
  workspace_id?: string | null;
  user_id?: string | null;
  task: string;
  provider_slug: string;
  model_id: string;
  status: "ok" | "error" | "cached" | "fallback" | "blocked";
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  cached: boolean;
  fallback_used: boolean;
  attempt: number;
  error?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_requests").insert({
      workspace_id: row.workspace_id ?? null,
      user_id: row.user_id ?? null,
      task: row.task,
      provider_slug: row.provider_slug,
      model_id: row.model_id,
      status: row.status,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cost_usd: row.cost_usd,
      latency_ms: row.latency_ms,
      cached: row.cached,
      fallback_used: row.fallback_used,
      attempt: row.attempt,
      error: row.error ?? null,
      metadata: (row.metadata ?? {}) as never,
    });
  } catch (err) {
    console.error("[ai-gateway] log failed", err);
  }
}

// ---------------------------------------------------------------------------
// Main entrypoint

const DEFAULT_TIMEOUT_MS = 20_000;

export async function runAI(input: RunAIInput): Promise<RunAIResult> {
  const started = Date.now();

  // 1) Global guards
  const switches = await killSwitchOn();
  if (switches.killed || switches.maintenance) {
    const reason = switches.killed ? "AI kill switch is engaged." : "AI is in maintenance mode.";
    await logRequest({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      task: input.task,
      provider_slug: "-",
      model_id: "-",
      status: "blocked",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      cached: false,
      fallback_used: false,
      attempt: 0,
      error: reason,
    });
    return failure(reason, started);
  }

  // 2) Workspace governance
  const settings = await loadWorkspaceSettings(input.workspaceId);
  if (settings && !settings.ai_enabled) {
    return failure("AI is disabled for this workspace.", started);
  }

  // 3) Route
  const route = await loadRoute(input.task);
  if (!route || !route.enabled) {
    return failure(`No enabled route for task "${input.task}"`, started);
  }

  // 4) Model chain: tier → tier's model, then secondary, then fallback
  const requestedTier: AiTier = input.tier ?? "primary";
  const chain: (string | null)[] = [];
  if (requestedTier === "premium" && settings?.premium_enabled !== false) {
    chain.push(route.premium_model_id, route.primary_model_id, route.secondary_model_id, route.fallback_model_id);
  } else if (requestedTier === "secondary") {
    chain.push(route.secondary_model_id, route.primary_model_id, route.fallback_model_id);
  } else if (requestedTier === "fallback") {
    chain.push(route.fallback_model_id);
  } else {
    chain.push(route.primary_model_id, route.secondary_model_id, route.fallback_model_id);
  }
  const modelIds = Array.from(new Set(chain.filter((x): x is string => !!x)));
  if (modelIds.length === 0) return failure("Route has no models configured.", started);

  // 5) Cache lookup (based on primary model id)
  const firstModel = await loadModel(modelIds[0]!);
  if (!firstModel) return failure("Primary model not found or disabled.", started);
  const cacheOn =
    route.cache_enabled && (settings?.cache_enabled ?? true) && route.cache_ttl_seconds > 0;
  const key = cacheOn
    ? cacheKey({ task: input.task, model: firstModel.model_id, system: input.system, user: input.user })
    : null;
  if (key) {
    const cached = await readCache(key);
    if (cached) {
      const latency = Date.now() - started;
      const text = extractText(cached.response);
      await logRequest({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        task: input.task,
        provider_slug: firstModel.provider_slug,
        model_id: firstModel.model_id,
        status: "cached",
        input_tokens: cached.input_tokens,
        output_tokens: cached.output_tokens,
        cost_usd: 0,
        latency_ms: latency,
        cached: true,
        fallback_used: false,
        attempt: 0,
        metadata: input.metadata,
      });
      return {
        ok: true,
        text,
        json: safeJson(text, !!input.json),
        model: firstModel.model_id,
        provider: firstModel.provider_slug,
        input_tokens: cached.input_tokens,
        output_tokens: cached.output_tokens,
        cost_usd: 0,
        latency_ms: latency,
        cached: true,
        fallback_used: false,
        attempt: 0,
      };
    }
  }

  // 6) Try each model in order
  const timeout = route.timeout_ms || DEFAULT_TIMEOUT_MS;
  let lastError: string | undefined;
  const allowFallback = settings?.fallback_enabled ?? true;

  for (let i = 0; i < modelIds.length; i++) {
    if (i > 0 && !allowFallback) break;
    const model = i === 0 ? firstModel : await loadModel(modelIds[i]!);
    if (!model || !model.enabled || !model.provider_enabled) continue;

    try {
      const t0 = Date.now();
      const call = await callModel(model, {
        system: input.system,
        user: input.user,
        json: !!input.json,
        timeout_ms: timeout,
        temperature: input.temperature,
        max_tokens: input.max_tokens,
      });
      const latency = Date.now() - t0;
      const cost = computeCost(model, call.input_tokens, call.output_tokens);
      const usedFallback = i > 0;

      if (key) {
        await writeCache({
          key,
          task: input.task,
          model: model.model_id,
          response: { text: call.text, json: call.json },
          input_tokens: call.input_tokens,
          output_tokens: call.output_tokens,
          ttl_seconds: route.cache_ttl_seconds,
        });
      }

      await logRequest({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        task: input.task,
        provider_slug: model.provider_slug,
        model_id: model.model_id,
        status: usedFallback ? "fallback" : "ok",
        input_tokens: call.input_tokens,
        output_tokens: call.output_tokens,
        cost_usd: cost,
        latency_ms: latency,
        cached: false,
        fallback_used: usedFallback,
        attempt: i + 1,
        metadata: input.metadata,
      });

      return {
        ok: true,
        text: call.text,
        json: call.json,
        model: model.model_id,
        provider: model.provider_slug,
        input_tokens: call.input_tokens,
        output_tokens: call.output_tokens,
        cost_usd: cost,
        latency_ms: latency,
        cached: false,
        fallback_used: usedFallback,
        attempt: i + 1,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await logRequest({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        task: input.task,
        provider_slug: model.provider_slug,
        model_id: model.model_id,
        status: "error",
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        latency_ms: Date.now() - started,
        cached: false,
        fallback_used: i > 0,
        attempt: i + 1,
        error: lastError,
        metadata: input.metadata,
      });
    }
  }

  return failure(lastError ?? "All models failed.", started);
}

function failure(msg: string, started: number): RunAIResult {
  return {
    ok: false,
    text: "",
    model: "-",
    provider: "-",
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    latency_ms: Date.now() - started,
    cached: false,
    fallback_used: false,
    attempt: 0,
    error: msg,
  };
}

function extractText(response: unknown): string {
  if (response && typeof response === "object" && "text" in response) {
    const t = (response as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return typeof response === "string" ? response : JSON.stringify(response);
}

function safeJson(text: string, json: boolean): unknown {
  if (!json) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
