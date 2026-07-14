import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe webhook — accepts payment_intent.payment_failed,
 * invoice.payment_failed, charge.failed. Signature verified against the
 * per-workspace webhook signing secret stored in integrations.credentials.
 *
 * URL: /api/public/webhooks/stripe?w=<workspace_id>
 * Each workspace configures its own webhook in the Stripe dashboard pointing
 * to this URL with its workspace id in the query string.
 */
export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get("w");
        if (!workspaceId) return new Response("Missing workspace id", { status: 400 });

        const raw = await request.text();
        const sigHeader = request.headers.get("stripe-signature") ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { decryptJSON } = await import("@/lib/crypto.server");

        // Locate the workspace's Stripe integration.
        const { data: integ, error } = await supabaseAdmin
          .from("integrations")
          .select("id, status, credentials_ciphertext, config")
          .eq("workspace_id", workspaceId)
          .eq("provider", "stripe")
          .maybeSingle();
        if (error) {
          console.error("[stripe webhook] lookup failed", error.message);
          return new Response("Internal error", { status: 500 });
        }
        if (!integ || !integ.credentials_ciphertext) {
          return new Response("Stripe not connected for workspace", { status: 404 });
        }

        let creds: { secret_key?: string; webhook_secret?: string };
        try {
          creds = decryptJSON<{ secret_key?: string; webhook_secret?: string }>(integ.credentials_ciphertext);
        } catch (err) {
          console.error("[stripe webhook] decrypt failed", err);
          return new Response("Bad workspace credentials", { status: 500 });
        }
        const secret = creds.webhook_secret?.trim();
        if (!secret) return new Response("Webhook secret not configured", { status: 400 });

        if (!verifyStripeSignature(raw, sigHeader, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: StripeEvent;
        try {
          event = JSON.parse(raw) as StripeEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        try {
          await handleEvent(workspaceId, event);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[stripe webhook] handler failed", event.type, msg);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function verifyStripeSignature(rawBody: string, header: string, secret: string): boolean {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string>>((acc, kv) => {
    const [k, v] = kv.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const signed = `${t}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handleEvent(workspaceId: string, event: StripeEvent): Promise<void> {
  const failureTypes: Record<string, "payment_intent" | "invoice" | "charge"> = {
    "payment_intent.payment_failed": "payment_intent",
    "invoice.payment_failed": "invoice",
    "charge.failed": "charge",
  };

  const successTypes = new Set([
    "payment_intent.succeeded",
    "invoice.payment_succeeded",
    "charge.succeeded",
  ]);

  const { ingestStripeFailure, runRecoveryForEvent } = await import("@/lib/recovery/engine.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (failureTypes[event.type]) {
    const eventId = await ingestStripeFailure({
      workspaceId,
      externalEventId: event.id,
      objectType: failureTypes[event.type],
      object: event.data.object,
    });
    if (eventId) {
      // Fire-and-await; Stripe will retry on non-200 so we complete inline.
      await runRecoveryForEvent({ eventId });
    }
    return;
  }

  if (successTypes.has(event.type)) {
    // Mark any open recovery event for this object as recovered.
    const objectId = (event.data.object.id as string | undefined) ?? null;
    if (!objectId) return;
    await supabaseAdmin
      .from("recovery_events")
      .update({ status: "recovered", recovered_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("external_object_id", objectId)
      .in("status", ["new", "analyzing", "recovering", "failed"]);
  }
}
