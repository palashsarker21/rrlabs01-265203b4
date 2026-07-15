/**
 * Generic webhook receiver for any provider connected in the Integration
 * Center. URL shape:
 *   /api/public/webhooks/:provider/:integrationId
 *
 * Each provider decides how to verify the request (HMAC-SHA256 over the raw
 * body against `integrations.webhook_secret`, or GET verify-token challenge
 * for Meta WhatsApp Cloud). Every delivery is logged to `webhook_logs` and
 * updates `provider_status`. Legacy Stripe/Lemon Squeezy webhook routes at
 * fixed paths keep their existing behaviour — this route is additive.
 */

import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const Route = createFileRoute("/api/public/webhooks/$provider/$integrationId")({
  server: {
    handlers: {
      // Meta WhatsApp verification handshake
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token && challenge) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: row } = await supabaseAdmin
            .from("integrations")
            .select("webhook_verify_token")
            .eq("id", params.integrationId)
            .eq("provider", params.provider)
            .maybeSingle();
          if (row && row.webhook_verify_token === token) {
            return new Response(challenge, { status: 200 });
          }
          return new Response("Forbidden", { status: 403 });
        }
        return new Response("ok", { status: 200 });
      },

      POST: async ({ request, params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rawBody = await request.text();
        const receivedAt = new Date().toISOString();

        // Load the integration row (server-role bypass RLS since caller is anonymous).
        const { data: integration } = await supabaseAdmin
          .from("integrations")
          .select("id, workspace_id, provider, webhook_secret, status")
          .eq("id", params.integrationId)
          .eq("provider", params.provider)
          .maybeSingle();

        if (!integration) {
          await supabaseAdmin.from("webhook_logs").insert({
            provider_code: params.provider,
            integration_id: null,
            workspace_id: null,
            signature_valid: false,
            status_code: 404,
            error: "integration_not_found",
            payload_hash: hashOf(rawBody),
            received_at: receivedAt,
          });
          return new Response("integration not found", { status: 404 });
        }

        // Verify signature. Most providers ship HMAC-SHA256(hex) over the raw body.
        const sigHeader =
          request.headers.get("x-signature") ||
          request.headers.get("x-hub-signature-256") ||
          request.headers.get("x-webhook-signature") ||
          request.headers.get("x-lemonsqueezy-signature") ||
          request.headers.get("stripe-signature") ||
          "";

        let signatureValid = false;
        if (integration.webhook_secret && sigHeader) {
          try {
            const expected = createHmac("sha256", integration.webhook_secret)
              .update(rawBody)
              .digest("hex");
            const provided = sigHeader.replace(/^sha256=/i, "").trim();
            const a = Buffer.from(expected, "hex");
            const b = Buffer.from(provided, "hex");
            signatureValid = a.length === b.length && timingSafeEqual(a, b);
          } catch {
            signatureValid = false;
          }
        }

        // Parse minimal event info for the log.
        let eventType: string | null = null;
        try {
          const j = JSON.parse(rawBody) as {
            event?: string;
            type?: string;
            meta?: { event_name?: string };
          };
          eventType = j.event ?? j.type ?? j.meta?.event_name ?? null;
        } catch {
          eventType = null;
        }

        // Persist the delivery log.
        await supabaseAdmin.from("webhook_logs").insert({
          workspace_id: integration.workspace_id,
          integration_id: integration.id,
          provider_code: params.provider,
          event_type: eventType,
          signature_valid: signatureValid,
          status_code: signatureValid ? 200 : 401,
          payload_hash: hashOf(rawBody),
          received_at: receivedAt,
          processed_at: signatureValid ? new Date().toISOString() : null,
          error: signatureValid ? null : "signature_invalid",
        });

        // Update health cache.
        await supabaseAdmin.from("provider_status").upsert(
          {
            integration_id: integration.id,
            last_delivery_at: receivedAt,
            last_success_at: signatureValid ? receivedAt : null,
            last_error: signatureValid ? null : "signature_invalid",
            verification_status: signatureValid ? "verified" : "failed",
            retry_count: 0,
          },
          { onConflict: "integration_id" },
        );

        if (!signatureValid) {
          return new Response("invalid signature", { status: 401 });
        }

        // Dispatch to the recovery engine if we have a hint of a failed payment.
        if (
          eventType &&
          /fail|past_due|declined|payment_failed/i.test(eventType)
        ) {
          try {
            const { ingestStripeFailure } = await import("@/lib/recovery/engine.server");
            await ingestStripeFailure({
              workspaceId: integration.workspace_id,
              provider: integration.provider,
              rawPayload: rawBody,
            }).catch(() => undefined);
          } catch {
            // engine may be unavailable — the webhook_logs row still records receipt.
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

function hashOf(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}
