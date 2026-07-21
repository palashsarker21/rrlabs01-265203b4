import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlatformBadges = {
  failedJobs: number;
  pendingEmails: number;
  pendingWhatsapp: number;
  webhookFailures: number;
  openIncidents: number;
  newTickets: number;
};

/**
 * Aggregated live counts for the Platform sidebar and top-bar badges.
 * Super-admin only. One round-trip; each count is best-effort — failures
 * degrade to zero rather than blocking the shell.
 */
export const getPlatformBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformBadges> => {
    const { supabase, userId } = context;

    const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSuper) {
      return {
        failedJobs: 0,
        pendingEmails: 0,
        pendingWhatsapp: 0,
        webhookFailures: 0,
        openIncidents: 0,
        newTickets: 0,
      };
    }

    const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
      try {
        const { count: c } = await q;
        return c ?? 0;
      } catch {
        return 0;
      }
    };

    const [failedJobs, pendingEmails, webhookFailures, openIncidents, newTickets] =
      await Promise.all([
        count(
          supabase
            .from("job_queue")
            .select("*", { count: "exact", head: true })
            .eq("status", "failed") as never,
        ),
        count(
          supabase
            .from("email_logs")
            .select("*", { count: "exact", head: true })
            .in("status", ["queued", "pending"]) as never,
        ),
        count(
          supabase
            .from("webhook_logs")
            .select("*", { count: "exact", head: true })
            .gte("status_code", 400) as never,
        ),
        count(
          supabase
            .from("incidents")
            .select("*", { count: "exact", head: true })
            .neq("status", "resolved") as never,
        ),
        count(
          supabase
            .from("support_conversations")
            .select("*", { count: "exact", head: true })
            .in("status", ["open", "pending"]) as never,
        ),
      ]);

    // WhatsApp queue lives inside job_queue with a channel column in some deployments;
    // best-effort fallback: 0 if column not present.
    let pendingWhatsapp = 0;
    try {
      const { count: c } = await supabase
        .from("job_queue")
        .select("*", { count: "exact", head: true })
        .eq("queue", "whatsapp")
        .in("status", ["queued", "pending"]);
      pendingWhatsapp = c ?? 0;
    } catch {
      pendingWhatsapp = 0;
    }

    return {
      failedJobs,
      pendingEmails,
      pendingWhatsapp,
      webhookFailures,
      openIncidents,
      newTickets,
    };
  });
