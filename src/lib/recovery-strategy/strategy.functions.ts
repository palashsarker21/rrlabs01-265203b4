import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BrandVoice = z.enum(["professional", "friendly", "premium", "luxury", "custom"]);
const AutomationMode = z.enum(["autopilot", "approval", "manual"]);
const Channel = z.enum(["email", "whatsapp", "sms", "push"]);

const StrategyInput = z.object({
  workspaceId: z.string().uuid(),
});

const UpdateInput = z.object({
  workspaceId: z.string().uuid(),
  brand_voice: BrandVoice,
  brand_voice_custom: z.string().max(500).nullable().optional(),
  automation_mode: AutomationMode,
  ai_enabled: z.boolean(),
  max_retries: z.number().int().min(1).max(10),
  retry_schedule_minutes: z.array(z.number().int().positive()).min(1).max(10),
  quiet_hours: z.object({ start: z.number().int().min(0).max(23), end: z.number().int().min(0).max(23) }),
  max_discount_percent: z.number().int().min(0).max(100),
  preferred_channels: z.array(Channel).min(1),
  escalation_rules: z.object({
    escalate_after_attempts: z.number().int().min(1).max(10),
    escalate_tone: z.enum(["warm", "neutral", "urgent"]),
    notify_owner_on_final_failure: z.boolean(),
  }),
  timezone: z.string().min(1).max(64),
});

export type RecoveryStrategy = z.infer<typeof UpdateInput>;

export const getRecoveryStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StrategyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("workspace_automation_settings")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      // Return defaults if row does not exist yet
      return {
        workspaceId: data.workspaceId,
        brand_voice: "professional" as const,
        brand_voice_custom: null,
        automation_mode: "autopilot" as const,
        ai_enabled: true,
        max_retries: 4,
        retry_schedule_minutes: [120, 1440, 4320],
        quiet_hours: { start: 21, end: 8 },
        max_discount_percent: 15,
        preferred_channels: ["whatsapp", "email", "sms"] as Array<z.infer<typeof Channel>>,
        escalation_rules: {
          escalate_after_attempts: 2,
          escalate_tone: "urgent" as const,
          notify_owner_on_final_failure: true,
        },
        timezone: "UTC",
      };
    }
    return {
      workspaceId: data.workspaceId,
      brand_voice: row.brand_voice as z.infer<typeof BrandVoice>,
      brand_voice_custom: row.brand_voice_custom ?? null,
      automation_mode: row.automation_mode as z.infer<typeof AutomationMode>,
      ai_enabled: row.ai_enabled,
      max_retries: row.max_retries,
      retry_schedule_minutes: row.retry_schedule_minutes,
      quiet_hours: row.quiet_hours as { start: number; end: number },
      max_discount_percent: row.max_discount_percent,
      preferred_channels: row.preferred_channels as Array<z.infer<typeof Channel>>,
      escalation_rules: row.escalation_rules as RecoveryStrategy["escalation_rules"],
      timezone: row.timezone,
    };
  });

export const updateRecoveryStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Permission check: workspace member with manage rights
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission to update recovery strategy.");

    const payload = {
      workspace_id: data.workspaceId,
      brand_voice: data.brand_voice,
      brand_voice_custom: data.brand_voice_custom ?? null,
      automation_mode: data.automation_mode,
      ai_enabled: data.ai_enabled,
      max_retries: data.max_retries,
      retry_schedule_minutes: data.retry_schedule_minutes,
      quiet_hours: data.quiet_hours,
      max_discount_percent: data.max_discount_percent,
      preferred_channels: data.preferred_channels,
      escalation_rules: data.escalation_rules,
      timezone: data.timezone,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("workspace_automation_settings")
      .upsert(payload, { onConflict: "workspace_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
