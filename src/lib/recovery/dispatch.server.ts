/**
 * Server-only outbound message dispatch adapters.
 * Load via dynamic import inside server-function or webhook handlers.
 */

export interface DispatchResult {
  ok: boolean;
  providerMessageId?: string;
  raw?: unknown;
  error?: string;
}

interface ResendCreds {
  api_key: string;
  from_email: string;
  from_name?: string;
}

export async function sendEmailViaResend(
  creds: ResendCreds,
  args: { to: string; subject: string; text: string; html?: string },
): Promise<DispatchResult> {
  const from = creds.from_name ? `${creds.from_name} <${creds.from_email}>` : creds.from_email;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: `Resend ${res.status}: ${JSON.stringify(body).slice(0, 300)}`, raw: body };
  }
  return { ok: true, providerMessageId: (body as { id?: string }).id, raw: body };
}

interface WhatsAppCreds {
  access_token: string;
  phone_number_id: string;
}

export async function sendWhatsAppText(
  creds: WhatsAppCreds,
  args: { to: string; text: string },
): Promise<DispatchResult> {
  const to = args.to.replace(/[^\d]/g, "");
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${encodeURIComponent(creds.phone_number_id)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: args.text.slice(0, 4000), preview_url: true },
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: `WhatsApp ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
      raw: body,
    };
  }
  const id = (body as { messages?: Array<{ id?: string }> }).messages?.[0]?.id;
  return { ok: true, providerMessageId: id, raw: body };
}
