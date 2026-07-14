import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-driven cadence tick. pg_cron POSTs here every ~15 minutes; we pick up
 * every recovery_event whose next_run_at is due and fire the recovery engine.
 *
 * Security: public route, but pg_cron sends the anon key in `apikey`. We check
 * that header matches SUPABASE_PUBLISHABLE_KEY before doing any work.
 */
export const Route = createFileRoute("/api/public/hooks/recovery-cadence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!apiKey || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runRecoveryForEvent } = await import("@/lib/recovery/engine.server");

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("recovery_events")
          .select("id")
          .in("status", ["new", "analyzing", "recovering", "failed"])
          .not("next_run_at", "is", null)
          .lte("next_run_at", nowIso)
          .order("next_run_at", { ascending: true })
          .limit(50);

        if (error) {
          console.error("[recovery-cadence] query failed", error.message);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const results = { processed: 0, failed: 0 };
        for (const ev of due ?? []) {
          try {
            await runRecoveryForEvent({ eventId: ev.id });
            results.processed++;
          } catch (err) {
            results.failed++;
            console.error("[recovery-cadence] event failed", ev.id, err);
          }
        }

        return new Response(JSON.stringify({ ok: true, ...results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
