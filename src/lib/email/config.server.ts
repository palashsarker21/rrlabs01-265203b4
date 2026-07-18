/**
 * Email configuration and startup validation.
 * Server-only. Reads process.env inside functions, never at module scope.
 */

export type EmailConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  webhookSecret?: string;
  domain: string;
};

export type EmailConfigResult =
  | { ok: true; config: EmailConfig }
  | { ok: false; missing: string[]; reason: string };

/**
 * Load and validate the Resend email config from environment.
 * Does NOT throw — returns a discriminated result so callers can log
 * diagnostics server-side while returning a generic message to end users.
 */
export function loadEmailConfig(): EmailConfigResult {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@rrlabs.online";
  const fromName = process.env.RESEND_FROM_NAME ?? "RRLabs";
  const replyTo = process.env.RESEND_REPLY_TO;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  const missing: string[] = [];
  if (!apiKey) missing.push("RESEND_API_KEY");

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      reason: `Email service not configured (missing ${missing.length} secret${missing.length === 1 ? "" : "s"})`,
    };
  }

  const domain = fromEmail.split("@")[1] ?? "rrlabs.online";

  return {
    ok: true,
    config: {
      apiKey: apiKey!,
      fromEmail,
      fromName,
      replyTo,
      webhookSecret,
      domain,
    },
  };
}

/**
 * Startup diagnostic. Logs a single structured line describing the email
 * subsystem state. Safe to call repeatedly. Never throws.
 */
export function logEmailStartupDiagnostics(): void {
  const result = loadEmailConfig();
  if (result.ok) {
    console.info(
      JSON.stringify({
        scope: "email.startup",
        status: "ready",
        provider: "resend",
        from: `${result.config.fromName} <${result.config.fromEmail}>`,
        webhook_configured: Boolean(result.config.webhookSecret),
      }),
    );
  } else {
    console.warn(
      JSON.stringify({
        scope: "email.startup",
        status: "unconfigured",
        missing: result.missing,
        reason: result.reason,
      }),
    );
  }
}
