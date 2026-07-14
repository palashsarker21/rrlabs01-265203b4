/**
 * Server-only audit log writer. Use from server functions or webhook handlers.
 * Never import from client code.
 */
import { getRequest } from "@tanstack/react-start/server";

export interface AuditEntry {
  workspaceId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const req = getRequest();
      if (req?.headers) {
        ip =
          req.headers.get("cf-connecting-ip") ??
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        ua = req.headers.get("user-agent");
      }
    } catch {
      /* not in a request context */
    }

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: entry.workspaceId ?? null,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      details: (entry.details ?? {}) as never,
      ip,
      user_agent: ua,
    });
  } catch (err) {
    // Never let audit failures break the primary action.
    console.error("[audit] write failed", err);
  }
}
