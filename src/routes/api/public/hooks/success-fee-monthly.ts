import { createFileRoute } from "@tanstack/react-router";

/**
 * Monthly cron entry point for the Success Fee engine.
 *
 * pg_cron POSTs here on the 1st of every month; we build draft statements
 * for the previous UTC calendar month. Idempotent — safe to re-run.
 *
 * Auth: same shared-secret pattern as `/api/public/hooks/recovery-cadence`
 * — pg_cron must send `apikey: <SUPABASE_PUBLISHABLE_KEY>`.
 */
export const Route = createFileRoute("/api/public/hooks/success-fee-monthly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!apiKey || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { previousMonthBounds, buildStatementsForPeriod } =
            await import("@/lib/success-fee/engine.server");
          const result = await buildStatementsForPeriod(previousMonthBounds());
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[success-fee-monthly] build failed", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
