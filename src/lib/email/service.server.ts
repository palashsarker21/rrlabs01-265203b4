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
import {
  buildUnsubscribeUrl,
  categoryForTemplate,
  shouldSendToRecipient,
} from "./preferences.server";

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
      metadata: row.metadata as never,
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
  await supabaseAdmin.from("email_logs").update(patch as never).eq("id", id);
}

async function renderTemplate(name: TemplateName, data: unknown): Promise<{ subject: string; html: string; text: string }> {
  const entry = TEMPLATES[name];
  if (!entry) throw new Error(`unknown template: ${String(name)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = entry.component as React.ComponentType<any>;
  const element = React.createElement(Component, data as object);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  const subject = entry.subject(data);
  return { subject, html, text };
}

async function sendViaResend(
  config: EmailConfig,
  args: {
    to: string[];
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    tags?: Record<string, string>;
    unsubscribeUrl?: string;
  },
): Promise<{ messageId: string | null }> {
  const client = new Resend(config.apiKey);
  const tagList = args.tags
    ? Object.entries(args.tags).map(([name, value]) => ({ name, value: String(value).slice(0, 256) }))
    : undefined;
  const headers: Record<string, string> = {};
  if (args.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${args.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const { data, error } = await client.emails.send({
    from: `${config.fromName} <${config.fromEmail}>`,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo: args.replyTo ?? config.replyTo,
    tags: tagList,
    headers: Object.keys(headers).length ? headers : undefined,
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

  // Honor opt-outs BEFORE hitting the provider. Transactional templates
  // (returned by categoryForTemplate as null) bypass this check.
  const optCheck = await shouldSendToRecipient(primary, opts.template).catch(() => ({
    allowed: true as const,
    category: categoryForTemplate(opts.template),
  }));
  if (!optCheck.allowed) {
    try {
      const r = await insertLog({
        workspace_id: opts.workspaceId ?? null,
        template: String(opts.template),
        recipient: primary,
        subject: "(unsubscribed)",
        idempotency_key: opts.idempotencyKey,
        metadata: { ...(opts.metadata ?? {}), status: "skipped_unsubscribed", category: optCheck.category },
      });
      await updateLog(r.id, {
        status: "skipped",
        last_error: `recipient unsubscribed from category "${optCheck.category ?? ""}"`,
        failed_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }
    log("info", "skipped_unsubscribed", { template: opts.template, category: optCheck.category });
    return {
      ok: true,
      id: "skipped",
      messageId: null,
      skipped: true,
      reason: `unsubscribed:${optCheck.category ?? ""}`,
    };
  }

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

  // Build a signed unsubscribe URL for opt-outable categories only.
  const category = categoryForTemplate(opts.template);
  const publicBase =
    process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://rrlabs.online";
  const unsubscribeUrl = category ? buildUnsubscribeUrl(primary, publicBase) : undefined;
  if (unsubscribeUrl) {
    const footerHtml = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#64748b;line-height:1.5">You're receiving this because you subscribed to ${category} emails from RRLabs. <a href="${unsubscribeUrl}" style="color:#0ea5a4">Unsubscribe or manage preferences</a>.</div>`;
    const footerText = `\n\n—\nYou're receiving this because you subscribed to ${category} emails from RRLabs.\nUnsubscribe or manage preferences: ${unsubscribeUrl}\n`;
    if (rendered.html.includes("</body>")) {
      rendered.html = rendered.html.replace("</body>", `${footerHtml}</body>`);
    } else {
      rendered.html = `${rendered.html}${footerHtml}`;
    }
    rendered.text = `${rendered.text}${footerText}`;
  }

  const { id: logId, alreadyExists } = await insertLog({
    workspace_id: opts.workspaceId ?? null,
    template: String(opts.template),
    recipient: primary,
    subject: rendered.subject,
    idempotency_key: opts.idempotencyKey,
    metadata: { ...(opts.metadata ?? {}), tags: opts.tags ?? null, cc_count: recipients.length - 1, category },
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
        unsubscribeUrl,
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
