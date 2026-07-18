/**
 * Resend webhook — delivery event ingestion.
 * Endpoint: POST /api/public/webhooks/resend
 *
 * Verifies the Svix signature (Resend uses Svix) before processing.
 * Updates `email_logs.status` and appends to `email_events`.
 */

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

type ResendEvent = {
  type: string;
  created_at?: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    [k: string]: unknown;
  };
};

function verifySvix(body: string, headers: Headers, secret: string): boolean {
  // Resend uses Svix — headers: svix-id, svix-timestamp, svix-signature
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sig = headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  // Secret comes in as `whsec_...`
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(rawSecret, "base64");
  const signedPayload = `${id}.${ts}.${body}`;
  const expected = createHmac("sha256", key).update(signedPayload).digest("base64");
  // Header is space-separated list of "v1,<sig>" pairs
  const given = sig
    .split(" ")
    .map((s) => s.split(",")[1])
    .filter(Boolean);
  return given.some((g) => {
    try {
      const a = Buffer.from(g!, "base64");
      const b = Buffer.from(expected, "base64");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch { return false; }
  });
}

function statusFromEvent(type: string): { status?: string; column?: string } {
  switch (type) {
    case "email.delivered":
      return { status: "delivered", column: "delivered_at" };
    case "email.bounced":
      return { status: "bounced", column: "failed_at" };
    case "email.complained":
      return { status: "complained", column: "failed_at" };
    case "email.delivery_delayed":
      return {};
    case "email.opened":
    case "email.clicked":
      return {};
    default:
      return {};
  }
}

export const Route = createFileRoute("/api/public/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!secret) {
          console.warn(JSON.stringify({ scope: "email.webhook", event: "unconfigured" }));
          return new Response("webhook not configured", { status: 503 });
        }
        if (!verifySvix(body, request.headers, secret)) {
          return new Response("invalid signature", { status: 401 });
        }
        let parsed: ResendEvent;
        try { parsed = JSON.parse(body); } catch {
          return new Response("bad json", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const messageId = parsed.data?.email_id ?? null;

        // Look up matching log
        let logId: string | null = null;
        if (messageId) {
          const { data } = await supabaseAdmin
            .from("email_logs")
            .select("id")
            .eq("provider_message_id", messageId)
            .maybeSingle();
          logId = data?.id ?? null;
        }

        await supabaseAdmin.from("email_events").insert({
          email_log_id: logId,
          provider_message_id: messageId,
          event_type: parsed.type.replace(/^email\./, ""),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: parsed as any,
        });

        const map = statusFromEvent(parsed.type);
        if (logId && map.status && map.column) {
          const patch: Record<string, unknown> = {
            status: map.status,
            [map.column]: new Date().toISOString(),
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await supabaseAdmin.from("email_logs").update(patch as any).eq("id", logId);
        }
        return new Response("ok");
      },
    },
  },
});
