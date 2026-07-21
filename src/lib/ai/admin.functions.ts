import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Only super admins may read/write AI platform config. */
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

export interface AdminProviderRow {
  id: string;
  slug: string;
  name: string;
  base_url: string;
  secret_env_var: string;
  enabled: boolean;
  priority: number;
  has_env_key: boolean;
  has_stored_key: boolean;
  api_key_updated_at: string | null;
}

export const listAiProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_providers")
      .select(
        "id, slug, name, base_url, secret_env_var, enabled, priority, encrypted_api_key, api_key_updated_at",
      )
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    const rows: AdminProviderRow[] = (data ?? []).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      base_url: r.base_url,
      secret_env_var: r.secret_env_var,
      enabled: r.enabled,
      priority: r.priority,
      has_env_key: !!process.env[r.secret_env_var],
      has_stored_key: !!r.encrypted_api_key,
      api_key_updated_at: r.api_key_updated_at,
    }));
    return { providers: rows };
  });

export const saveAiProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        providerId: z.string().uuid(),
        apiKey: z.string().trim().min(8).max(500),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { encryptJSON } = await import("@/lib/crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const encrypted = encryptJSON(data.apiKey);
    const { error } = await supabaseAdmin
      .from("ai_providers")
      .update({
        encrypted_api_key: encrypted,
        api_key_updated_at: new Date().toISOString(),
        api_key_updated_by: context.userId,
      })
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearAiProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ providerId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_providers")
      .update({
        encrypted_api_key: null,
        api_key_updated_at: new Date().toISOString(),
        api_key_updated_by: context.userId,
      })
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ providerId: z.string().uuid(), enabled: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_providers")
      .update({ enabled: data.enabled })
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ providerId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pick any enabled model for this provider and hit /chat/completions with a tiny prompt.
    const { data: provider } = await supabaseAdmin
      .from("ai_providers")
      .select("slug, base_url, secret_env_var, encrypted_api_key")
      .eq("id", data.providerId)
      .maybeSingle();
    if (!provider) throw new Error("Provider not found");
    const { data: model } = await supabaseAdmin
      .from("ai_models")
      .select("model_id, supports_json")
      .eq("provider_id", data.providerId)
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    if (!model) throw new Error("No enabled models for this provider yet");

    let key = process.env[provider.secret_env_var];
    if (!key && provider.encrypted_api_key) {
      const { decryptJSON } = await import("@/lib/crypto.server");
      key = decryptJSON<string>(provider.encrypted_api_key);
    }
    if (!key) throw new Error("No API key set (env or admin panel)");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };
    if (provider.slug === "lovable" || provider.slug === "google") {
      headers["Lovable-API-Key"] = key;
    }
    if (provider.slug === "openrouter") {
      headers["HTTP-Referer"] = "https://www.rrlabs.online";
      headers["X-Title"] = "RRLabs";
    }

    const t0 = Date.now();
    const res = await fetch(`${provider.base_url}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model.model_id,
        messages: [{ role: "user", content: "Reply with the single word: pong" }],
        max_tokens: 8,
      }),
    });
    const latency = Date.now() - t0;
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      latency_ms: latency,
      model: model.model_id,
      response_preview: body.slice(0, 400),
    };
  });
