import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Per-workspace AI settings.
 *
 * Reads: any workspace member (RLS `org_ai_settings members select`).
 * Writes: owner/admin/manager (RLS `org_ai_settings admins write` +
 * enforced here via `can_manage_workspace`).
 */

export interface OrgAiSettings {
  workspace_id: string;
  ai_enabled: boolean;
  cache_enabled: boolean;
  fallback_enabled: boolean;
  premium_enabled: boolean;
  monthly_budget_usd: number | null;
  monthly_token_limit: number | null;
  daily_budget_usd: number | null;
  budget_alert_threshold: number;
  default_model: string | null;
  custom_system_prompt: string | null;
  updated_at: string;
}

export interface AvailableModelOption {
  model_id: string;
  provider: string;
}

const WorkspaceInput = z.object({ workspaceId: z.string().uuid() });

export const getOrgAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => WorkspaceInput.parse(raw))
  .handler(async ({ data, context }): Promise<OrgAiSettings> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("organization_ai_settings")
      .select(
        "workspace_id, ai_enabled, cache_enabled, fallback_enabled, premium_enabled, monthly_budget_usd, monthly_token_limit, daily_budget_usd, budget_alert_threshold, default_model, custom_system_prompt, updated_at",
      )
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) return row as OrgAiSettings;
    // Return defaults (record may not exist yet); client can still save.
    return {
      workspace_id: data.workspaceId,
      ai_enabled: true,
      cache_enabled: true,
      fallback_enabled: true,
      premium_enabled: false,
      monthly_budget_usd: null,
      monthly_token_limit: null,
      daily_budget_usd: null,
      budget_alert_threshold: 0.8,
      default_model: null,
      custom_system_prompt: null,
      updated_at: new Date().toISOString(),
    };
  });

const UpdateInput = z.object({
  workspaceId: z.string().uuid(),
  ai_enabled: z.boolean(),
  cache_enabled: z.boolean(),
  fallback_enabled: z.boolean(),
  premium_enabled: z.boolean(),
  monthly_budget_usd: z.number().nonnegative().nullable(),
  monthly_token_limit: z.number().int().nonnegative().nullable(),
  daily_budget_usd: z.number().nonnegative().nullable(),
  budget_alert_threshold: z.number().min(0).max(1),
  default_model: z.string().max(200).nullable(),
  custom_system_prompt: z.string().max(8000).nullable(),
});

export const updateOrgAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => UpdateInput.parse(raw))
  .handler(async ({ data, context }): Promise<OrgAiSettings> => {
    const { supabase, userId } = context;
    // Explicit role guard on top of RLS.
    const { data: canManage, error: rpcErr } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (!canManage)
      throw new Error("You must be a workspace owner or admin to modify AI settings.");

    const { workspaceId, ...rest } = data;
    const payload = {
      workspace_id: workspaceId,
      ...rest,
      updated_at: new Date().toISOString(),
    };
    const { data: row, error } = await supabase
      .from("organization_ai_settings")
      .upsert(payload, { onConflict: "workspace_id" })
      .select(
        "workspace_id, ai_enabled, cache_enabled, fallback_enabled, premium_enabled, monthly_budget_usd, monthly_token_limit, daily_budget_usd, budget_alert_threshold, default_model, custom_system_prompt, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return row as OrgAiSettings;
  });

export const listAvailableAiModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AvailableModelOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_models")
      .select("model_id, ai_providers!inner(slug, enabled)")
      .eq("enabled", true)
      .order("model_id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((r) => {
        const p = (r as unknown as { ai_providers: { slug: string; enabled: boolean } })
          .ai_providers;
        return { model_id: r.model_id as string, provider: p.slug, enabled: p.enabled };
      })
      .filter((r) => r.enabled)
      .map(({ model_id, provider }) => ({ model_id, provider }));
  });
