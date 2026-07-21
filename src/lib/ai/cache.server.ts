/**
 * AI response cache — server only.
 * Keyed by SHA-256(task || model || system || user). TTL from ai_routes.
 */
import { createHash } from "node:crypto";

export function cacheKey(input: {
  task: string;
  model: string;
  system?: string | null;
  user: string;
}): string {
  const h = createHash("sha256");
  h.update(input.task);
  h.update("\x1f");
  h.update(input.model);
  h.update("\x1f");
  h.update(input.system ?? "");
  h.update("\x1f");
  h.update(input.user);
  return h.digest("hex");
}

export interface CachedResponse {
  response: unknown;
  input_tokens: number;
  output_tokens: number;
}

export async function readCache(key: string): Promise<CachedResponse | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ai_cache")
    .select("response, input_tokens, output_tokens, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  // Bump hit counter — fire and forget.
  void supabaseAdmin
    .from("ai_cache")
    .update({ hit_count: 1, last_hit_at: new Date().toISOString() })
    .eq("cache_key", key)
    .then(() => {});
  return {
    response: data.response,
    input_tokens: data.input_tokens ?? 0,
    output_tokens: data.output_tokens ?? 0,
  };
}

export async function writeCache(args: {
  key: string;
  task: string;
  model: string;
  response: unknown;
  input_tokens: number;
  output_tokens: number;
  ttl_seconds: number;
}): Promise<void> {
  if (args.ttl_seconds <= 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expires = new Date(Date.now() + args.ttl_seconds * 1000).toISOString();
  await supabaseAdmin.from("ai_cache").upsert(
    {
      cache_key: args.key,
      task: args.task,
      model_id: args.model,
      response: args.response as never,
      input_tokens: args.input_tokens,
      output_tokens: args.output_tokens,
      expires_at: expires,
    },
    { onConflict: "cache_key" },
  );
}
