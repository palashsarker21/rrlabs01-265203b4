/**
 * Centralized transactional email service — Resend-backed.
 * Server-only.
 *
 * Responsibilities:
 *   - Render React Email templates to HTML/text
 *   - Persist idempotent send attempts in `email_logs`
 *   - Retry transient failures with exponential backoff
 *   - Log structured diagnostics; never leak secrets
 *   - Return generic errors to callers that touch the client
 */

import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadEmailConfig, type EmailConfig } from "./config.server";
import { TEMPLATES, type TemplateName, isTemplateName } from "./templates/registry";

export type SendResult =
  | { ok: true; id: string; messageId: string | null; skipped?: boolean; reason?: string }
  | { ok: false; error: string; code: "unconfigured" | "invalid_template" | "provider_error" | "unknown" };

export type SendOptions<P> = {
  template: TemplateName;
  to: string | string[];
  data: P;
  workspaceId?: string | null;
  idempotencyKey?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 400;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizeRecipients(to: string | string[]): string[] {
  const arr = Array.isArray(to) ? to : [to];
  return arr.map((s) => s.trim()).filter(isValidEmail);
}

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ scope: "email", event, level, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

async function insertLog(row: {
  workspace_id?: string | null;
  template: string;
  recipient: string;
  subject: string;
  idempotency_key?: string;
  metadata: Record<string, unknown>;
}): Promise<{ id: string; alreadyExists: boolean }> {
  if (row.idempotency_key) {
    const { data: existing } = await supabaseAdmin
      .from("email_logs")
      .select("id,status")
      .eq("idempotency_key", row.idempotency_key)
      .maybeSingle();
    if (existing && existing.status !== "failed") {
      return { id: existing.id, alreadyExists: true };
    }
    if (existing) {
      // Retry previously failed idempotent send: reuse the row.
      return { id: existing.id, alreadyExists: false };
    }
  }
  const { data, error } = await supabaseAdmin
    .from("email_logs")
    .insert({
      workspace_id: row.workspace_id ?? null,
      template: row.template,
      recipient: row.recipient,
      subject: row.subject,
      idempotency_key: row.idempotency_key ?? null,
      metadata: row.metadata,
      status: "queued",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`email_logs insert failed: ${error?.message ?? "unknown"}`);
  }
  return { id: data.id, alreadyExists: false };
}

async function updateLog(id: string, patch: Record<string, unknown>) {
  await supabaseAdmin.from("email_logs").update(patch).eq("id", id);
}

async function renderTemplate<P>(name: TemplateName, data: P): Promise<{ subject: string; html: string; text: string }> {
  const entry = TEMPLATES[name];
  if (!entry) throw new Error(`unknown template: ${String(name)}`);
  const element = React.createElement(entry.component as React.ComponentType<P>, data);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  const subject = entry.subject(data);
  return { subject, html, text };
}

async function sendViaResend(
  config: EmailConfig,
  args: { to: string[]; subject: string; html: string; text: string; replyTo?: string; tags?: Record<string, string> },
): Promise<{ messageId: string | null }> {
  const client = new Resend(config.apiKey);
  const tagList = args.tags
    ? Object.entries(args.tags).map(([name, value]) => ({ name, value: String(value).slice(0, 256) }))
    : undefined;
  const { data, error } = await client.emails.send({
    from: `${config.fromName} <${config.fromEmail}>`,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo: args.replyTo ?? config.replyTo,
    tags: tagList,
  });
  if (error) {
    throw new Error(error.message ?? "Resend API error");
  }
  return { messageId: data?.id ?? null };
}

/**
 * Central entry point for sending a transactional email.
 * Safe to call from server functions, webhook routes, and cron jobs.
 */
export async function sendEmail<P>(opts: SendOptions<P>): Promise<SendResult> {
  const cfg = loadEmailConfig();
  const recipients = normalizeRecipients(opts.to);
  if (recipients.length === 0) {
    log("warn", "invalid_recipient", { template: opts.template });
    return { ok: false, error: "Email service unavailable.", code: "unknown" };
  }
  if (!isTemplateName(opts.template)) {
    log("error", "invalid_template", { template: opts.template });
    return { ok: false, error: "Email service unavailable.", code: "invalid_template" };
  }

  const primary = recipients[0]!;

  if (!cfg.ok) {
    log("error", "unconfigured", { missing: cfg.missing, template: opts.template });
    // Still persist a log so admins can see attempted sends.
    try {
      await insertLog({
        workspace_id: opts.workspaceId ?? null,
        template: String(opts.template),
        recipient: primary,
        subject: "(unconfigured)",
        idempotency_key: opts.idempotencyKey,
        metadata: { ...(opts.metadata ?? {}), status: "skipped_unconfigured" },
      }).then((r) => updateLog(r.id, {
        status: "skipped",
        last_error: "email service unavailable",
        failed_at: new Date().toISOString(),
      })).catch(() => {});
    } catch { /* ignore */ }
    return { ok: false, error: "Email service unavailable.", code: "unconfigured" };
  }

  let rendered;
  try {
    rendered = await renderTemplate(opts.template, opts.data);
  } catch (err) {
    log("error", "render_failed", {
      template: opts.template,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Email service unavailable.", code: "unknown" };
  }

  const { id: logId, alreadyExists } = await insertLog({
    workspace_id: opts.workspaceId ?? null,
    template: String(opts.template),
    recipient: primary,
    subject: rendered.subject,
    idempotency_key: opts.idempotencyKey,
    metadata: { ...(opts.metadata ?? {}), tags: opts.tags ?? null, cc_count: recipients.length - 1 },
  });

  if (alreadyExists) {
    log("info", "idempotent_skip", { template: opts.template, id: logId });
    return { ok: true, id: logId, messageId: null, skipped: true, reason: "idempotent" };
  }

  let lastErr: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await updateLog(logId, { attempts: attempt });
      const { messageId } = await sendViaResend(cfg.config, {
        to: recipients,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: opts.replyTo,
        tags: { template: String(opts.template), ...(opts.tags ?? {}) },
      });
      await updateLog(logId, {
        status: "sent",
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
        last_error: null,
      });
      log("info", "sent", { template: opts.template, id: logId, message_id: messageId, attempt });
      return { ok: true, id: logId, messageId };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      log("warn", "send_attempt_failed", {
        template: opts.template,
        id: logId,
        attempt,
        error: lastErr,
      });
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
      }
    }
  }

  await updateLog(logId, {
    status: "failed",
    last_error: lastErr,
    failed_at: new Date().toISOString(),
  });
  log("error", "send_failed", { template: opts.template, id: logId, error: lastErr });
  return { ok: false, error: "Email service unavailable.", code: "provider_error" };
}
