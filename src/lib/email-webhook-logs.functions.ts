/**
 * Admin: Resend webhook diagnostics.
 *
 * Super-admin gated server functions to list and inspect inbound
 * Resend webhook deliveries recorded in `public.email_webhook_logs`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const OUTCOMES = [
  "all",
  "accepted",
  "invalid_signature",
  "unconfigured",
  "bad_json",
  "error",
] as const;

const ListInput = z.object({
  outcome: z.enum(OUTCOMES).optional().default("all"),
  eventType: z.string().trim().optional().default(""),
  messageId: z.string().trim().optional().default(""),
  svixId: z.string().trim().optional().default(""),
  signatureValid: z.enum(["any", "valid", "invalid"]).optional().default("any"),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const listWebhookDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);

    let q = context.supabase
      .from("email_webhook_logs")
      .select(
        "id, received_at, provider, svix_id, event_type, provider_message_id, signature_valid, outcome, status_code, error, processing_ms, matched_log_id",
        { count: "exact" },
      )
      .order("received_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.outcome !== "all") q = q.eq("outcome", data.outcome);
    if (data.eventType) q = q.eq("event_type", data.eventType);
    if (data.messageId) q = q.eq("provider_message_id", data.messageId);
    if (data.svixId) q = q.eq("svix_id", data.svixId);
    if (data.signatureValid === "valid") q = q.eq("signature_valid", true);
    if (data.signatureValid === "invalid") q = q.eq("signature_valid", false);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // Counters (unfiltered) for the status chip strip.
    const { data: counters } = await context.supabase.from("email_webhook_logs").select("outcome");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const counts: Record<string, number> = { all: (counters as any[] | null)?.length ?? 0 };
    for (const o of OUTCOMES) if (o !== "all") counts[o] = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (counters as any[]) ?? []) {
      const k = row.outcome as string;
      counts[k] = (counts[k] ?? 0) + 1;
    }

    return {
      rows: (rows ?? []) as Array<{
        id: string;
        received_at: string;
        provider: string;
        svix_id: string | null;
        event_type: string | null;
        provider_message_id: string | null;
        signature_valid: boolean;
        outcome: string;
        status_code: number;
        error: string | null;
        processing_ms: number | null;
        matched_log_id: string | null;
      }>,
      total: count ?? 0,
      counts,
    };
  });

export const getWebhookDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);

    const { data: row, error } = await context.supabase
      .from("email_webhook_logs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Webhook log not found");
    return row;
  });
