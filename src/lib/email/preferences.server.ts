/**
 * Email subscription preferences + signed unsubscribe tokens.
 * Server-only.
 *
 *  - Categories: billing, analytics, recovery, product, marketing.
 *  - Transactional emails (welcome, verify, reset, invite, payment-failed,
 *    system-alert, contact-message) are NEVER opt-outable. They bypass
 *    preference checks entirely.
 *  - Unsubscribe tokens are HMAC-signed with RRLABS_ENCRYPTION_KEY so we
 *    do not need to persist tokens.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TemplateName } from "./templates/registry";

export const EMAIL_CATEGORIES = [
  "billing",
  "analytics",
  "recovery",
  "product",
  "marketing",
] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, { label: string; description: string }> =
  {
    billing: {
      label: "Billing & payments",
      description:
        "Invoices, payment receipts, monthly success-fee statements, and trial reminders.",
    },
    analytics: {
      label: "Analytics & reports",
      description: "Weekly recovery reports and recovery summary emails.",
    },
    recovery: {
      label: "Recovery activity",
      description: "Notifications about the recovery engine's activity for your workspace.",
    },
    product: {
      label: "Product updates",
      description: "Feature announcements, roadmap news, and product changelogs.",
    },
    marketing: {
      label: "Tips & offers",
      description: "Best-practice tips, guides, and occasional promotional offers.",
    },
  };

/**
 * Map every template to a category — or `null` for transactional emails
 * that cannot be opted out of (account security, invitations, critical
 * billing failures, contact-form replies, direct alerts).
 */
const TEMPLATE_CATEGORY: Record<string, EmailCategory | null> = {
  welcome: null,
  "verify-email": null,
  "reset-password": null,
  "invite-member": null,
  "workspace-invite": null,
  "system-alert": null,
  "contact-message": null,
  "payment-failed": null,
  "trial-started": "billing",
  "trial-ending": "billing",
  "subscription-activated": "billing",
  "payment-successful": "billing",
  "success-fee-invoice": "billing",
  "weekly-analytics": "analytics",
  "recovery-summary": "analytics",
};

export function categoryForTemplate(name: TemplateName | string): EmailCategory | null {
  return TEMPLATE_CATEGORY[name] ?? null;
}

/* ------------------------------------------------------------------ *
 * Signed tokens
 * ------------------------------------------------------------------ */

function signingKey(): Buffer {
  const raw = process.env.RRLABS_ENCRYPTION_KEY;
  if (!raw) throw new Error("RRLABS_ENCRYPTION_KEY is not set");
  // Domain-separate from the AES key used by crypto.server.ts.
  return createHash("sha256").update(`unsub:${raw}`, "utf8").digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/**
 * Signs `{email, iat}` and returns a compact string safe for URLs.
 * Tokens are valid for 180 days; they identify a mailbox, not a session.
 */
export function signUnsubscribeToken(email: string): string {
  const payload = { e: email.trim().toLowerCase(), t: Math.floor(Date.now() / 1000) };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", signingKey()).update(body).digest());
  return `${body}.${sig}`;
}

const MAX_TOKEN_AGE_SECONDS = 60 * 60 * 24 * 180;

export function verifyUnsubscribeToken(token: string): { email: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = createHmac("sha256", signingKey()).update(body).digest();
  let provided: Buffer;
  try {
    provided = fromB64url(sig);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  try {
    const raw = fromB64url(body).toString("utf8");
    const parsed = JSON.parse(raw) as { e?: string; t?: number };
    if (!parsed.e || typeof parsed.t !== "number") return null;
    const age = Math.floor(Date.now() / 1000) - parsed.t;
    if (age < 0 || age > MAX_TOKEN_AGE_SECONDS) return null;
    return { email: parsed.e };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * DB helpers
 * ------------------------------------------------------------------ */

export type PreferenceMap = Record<EmailCategory, boolean>;

export function defaultPreferences(): PreferenceMap {
  return {
    billing: true,
    analytics: true,
    recovery: true,
    product: true,
    marketing: true,
  };
}

export async function loadPreferencesFor(email: string): Promise<PreferenceMap> {
  const prefs = defaultPreferences();
  const { data } = await supabaseAdmin
    .from("email_subscription_preferences")
    .select("category, subscribed")
    .eq("email", email.trim().toLowerCase());
  for (const row of data ?? []) {
    const c = row.category as EmailCategory;
    if (c in prefs) prefs[c] = Boolean(row.subscribed);
  }
  return prefs;
}

export async function setPreferences(
  email: string,
  updates: Partial<PreferenceMap>,
  source: string,
): Promise<PreferenceMap> {
  const rows = (Object.entries(updates) as [EmailCategory, boolean][])
    .filter(([c]) => (EMAIL_CATEGORIES as readonly string[]).includes(c))
    .map(([category, subscribed]) => ({
      email: email.trim().toLowerCase(),
      category,
      subscribed,
      source,
    }));
  if (rows.length === 0) return loadPreferencesFor(email);
  const { error } = await supabaseAdmin
    .from("email_subscription_preferences")
    .upsert(rows, { onConflict: "email,category" });
  if (error) throw new Error(`preferences upsert failed: ${error.message}`);
  return loadPreferencesFor(email);
}

export async function unsubscribeAll(email: string, source: string): Promise<PreferenceMap> {
  const updates: Partial<PreferenceMap> = {};
  for (const c of EMAIL_CATEGORIES) updates[c] = false;
  return setPreferences(email, updates, source);
}

/**
 * Should this recipient receive this template right now?
 * Transactional templates always return true.
 */
export async function shouldSendToRecipient(
  email: string,
  template: TemplateName | string,
): Promise<{ allowed: boolean; category: EmailCategory | null }> {
  const category = categoryForTemplate(template);
  if (!category) return { allowed: true, category: null };
  const prefs = await loadPreferencesFor(email);
  return { allowed: prefs[category] !== false, category };
}

export function buildUnsubscribeUrl(email: string, baseUrl: string): string {
  const token = signUnsubscribeToken(email);
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
}
