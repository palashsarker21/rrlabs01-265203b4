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
    return {
      ok: false,
      error: `Resend ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
      raw: body,
    };
  }
  return { ok: true, providerMessageId: (body as { id?: string }).id, raw: body };
}

interface SendGridCreds {
  api_key: string;
  from_email: string;
  from_name?: string;
}

export async function sendEmailViaSendGrid(
  creds: SendGridCreds,
  args: { to: string; subject: string; text: string; html?: string },
): Promise<DispatchResult> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from: { email: creds.from_email, name: creds.from_name },
      subject: args.subject,
      content: [
        { type: "text/plain", value: args.text },
        ...(args.html ? [{ type: "text/html", value: args.html }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `SendGrid ${res.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true, providerMessageId: res.headers.get("x-message-id") ?? undefined };
}

/**
 * SMTP is unavailable from the Cloudflare Worker runtime (no raw TCP sockets).
 * We surface a clear error so the caller can fall back to Resend / SendGrid.
 * Wire SMTP later via an external relay (e.g. a small Node worker) if needed.
 */
export async function sendEmailViaSmtp(): Promise<DispatchResult> {
  return {
    ok: false,
    error:
      "SMTP dispatch is not supported from the edge runtime. Use Resend or SendGrid, or configure an SMTP-to-HTTP relay.",
  };
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
