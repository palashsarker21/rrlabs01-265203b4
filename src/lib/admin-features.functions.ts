/**
 * Super-admin feature/provider control surface.
 * All writes gated by `has_role(auth.uid(), 'super_admin')`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireSuperAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("feature_flags")
      .select("*")
      .order("key", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        key: z.string().min(1),
        enabled: z.boolean().optional(),
        beta: z.boolean().optional(),
        maintenance_mode: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { enabled?: boolean; beta?: boolean; maintenance_mode?: boolean } = {};
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.beta !== undefined) patch.beta = data.beta;
    if (data.maintenance_mode !== undefined) patch.maintenance_mode = data.maintenance_mode;
    const { error } = await supabaseAdmin
      .from("feature_flags")
      .update(patch)
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listProvidersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("provider_catalog")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setProviderEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ code: z.string().min(1), enabled: z.boolean(), beta: z.boolean().optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { enabled: boolean; beta?: boolean } = { enabled: data.enabled };
    if (data.beta !== undefined) patch.beta = data.beta;
    const { error } = await supabaseAdmin
      .from("provider_catalog")
      .update(patch)
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setWorkspaceOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        featureKey: z.string().min(1),
        enabled: z.boolean().nullable().optional(),
        limitOverride: z.number().int().min(0).nullable().optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("workspace_feature_overrides").upsert(
      {
        workspace_id: data.workspaceId,
        feature_key: data.featureKey,
        enabled: data.enabled ?? null,
        limit_override: data.limitOverride ?? null,
        notes: data.notes ?? null,
      },
      { onConflict: "workspace_id,feature_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
