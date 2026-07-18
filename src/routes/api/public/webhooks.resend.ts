/**
 * Resend webhook — delivery event ingestion.
 * Endpoint: POST /api/public/webhooks/resend
 *
 * - Verifies the Svix signature (Resend uses Svix) before processing.
 * - Records EVERY inbound request (verified or not) into
 *   `public.email_webhook_logs` for the admin diagnostics view.
 * - Updates `email_logs.status` and appends to `email_events` on success.
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

type VerifyResult = { valid: boolean; reason?: string };

function verifySvix(body: string, headers: Headers, secret: string): VerifyResult {
  // Resend uses Svix — headers: svix-id, svix-timestamp, svix-signature
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sig = headers.get("svix-signature");
  if (!id || !ts || !sig) return { valid: false, reason: "missing svix headers" };

  // Reject stale timestamps (>5min skew) — defends against replay attacks.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { valid: false, reason: "invalid svix-timestamp" };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > 5 * 60) {
    return { valid: false, reason: "timestamp outside tolerance" };
  }

  // Secret comes in as `whsec_...`
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(rawSecret, "base64");
  } catch {
    return { valid: false, reason: "malformed secret" };
  }
  const signedPayload = `${id}.${ts}.${body}`;
  const expected = createHmac("sha256", key).update(signedPayload).digest("base64");

  // Header is space-separated list of "v1,<sig>" pairs
  const given = sig
    .split(" ")
    .map((s) => s.split(",")[1])
    .filter(Boolean);
  if (given.length === 0) return { valid: false, reason: "no v1 signatures" };

  const expBuf = Buffer.from(expected, "base64");
  const ok = given.some((g) => {
    try {
      const a = Buffer.from(g!, "base64");
      return a.length === expBuf.length && timingSafeEqual(a, expBuf);
    } catch {
      return false;
    }
  });
  return ok ? { valid: true } : { valid: false, reason: "signature mismatch" };
}

function statusFromEvent(type: string): { status?: string; column?: string } {
  switch (type) {
    case "email.delivered":
      return { status: "delivered", column: "delivered_at" };
    case "email.bounced":
      return { status: "bounced", column: "failed_at" };
    case "email.complained":
      return { status: "complained", column: "failed_at" };
    default:
      return {};
  }
}

const REDACTED_HEADERS = new Set(["authorization", "cookie", "svix-signature"]);

function redactedHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    const k = key.toLowerCase();
    out[k] = REDACTED_HEADERS.has(k) ? "[redacted]" : value;
  });
  return out;
}

export const Route = createFileRoute("/api/public/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const body = await request.text();
        const headers = request.headers;
        const svixId = headers.get("svix-id");
        const svixTs = headers.get("svix-timestamp");
        const secret = process.env.RESEND_WEBHOOK_SECRET;

        // Best-effort parse first — needed so we can log event type on any outcome.
        let parsed: ResendEvent | null = null;
        let parseError: string | null = null;
        try {
          parsed = body ? (JSON.parse(body) as ResendEvent) : null;
        } catch (e) {
          parseError = e instanceof Error ? e.message : String(e);
        }

        const bodySnippet = body.length > 4000 ? body.slice(0, 4000) + "…" : body;
        const headerSnapshot = redactedHeaders(headers);
        let outcome: string;
        let statusCode = 200;
        let errorText: string | null = null;
        let signatureValid = false;
        let matchedLogId: string | null = null;

        // Load admin client lazily (server-only).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const persist = async () => {
          try {
            await supabaseAdmin.from("email_webhook_logs").insert({
              provider: "resend",
              svix_id: svixId,
              svix_timestamp: svixTs,
              event_type: parsed?.type ?? null,
              provider_message_id: parsed?.data?.email_id ?? null,
              signature_valid: signatureValid,
              outcome,
              status_code: statusCode,
              error: errorText,
              processing_ms: Date.now() - startedAt,
              matched_log_id: matchedLogId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              headers: headerSnapshot as any,
              body_snippet: bodySnippet,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              payload: (parsed as any) ?? null,
            });
          } catch (e) {
            console.error(
              JSON.stringify({
                scope: "email.webhook",
                event: "log_failed",
                error: e instanceof Error ? e.message : String(e),
              }),
            );
          }
        };

        if (!secret) {
          outcome = "unconfigured";
          statusCode = 503;
          errorText = "RESEND_WEBHOOK_SECRET is not set";
          await persist();
          return new Response("webhook not configured", { status: 503 });
        }

        const verify = verifySvix(body, headers, secret);
        signatureValid = verify.valid;
        if (!verify.valid) {
          outcome = "invalid_signature";
          statusCode = 401;
          errorText = verify.reason ?? "signature verification failed";
          await persist();
          return new Response("invalid signature", { status: 401 });
        }

        if (!parsed) {
          outcome = "bad_json";
          statusCode = 400;
          errorText = parseError ?? "empty body";
          await persist();
          return new Response("bad json", { status: 400 });
        }

        try {
          const messageId = parsed.data?.email_id ?? null;

          if (messageId) {
            const { data } = await supabaseAdmin
              .from("email_logs")
              .select("id")
              .eq("provider_message_id", messageId)
              .maybeSingle();
            matchedLogId = data?.id ?? null;
          }

          await supabaseAdmin.from("email_events").insert({
            email_log_id: matchedLogId,
            provider_message_id: messageId,
            event_type: parsed.type.replace(/^email\./, ""),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: parsed as any,
          });

          const map = statusFromEvent(parsed.type);
          if (matchedLogId && map.status && map.column) {
            const patch: Record<string, unknown> = {
              status: map.status,
              [map.column]: new Date().toISOString(),
            };
            await supabaseAdmin
              .from("email_logs")
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .update(patch as any)
              .eq("id", matchedLogId);
          }

          outcome = "accepted";
          statusCode = 200;
          await persist();
          return new Response("ok");
        } catch (e) {
          outcome = "error";
          statusCode = 500;
          errorText = e instanceof Error ? e.message : String(e);
          await persist();
          return new Response("internal error", { status: 500 });
        }
      },
    },
  },
});
