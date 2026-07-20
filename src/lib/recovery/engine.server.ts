/**
 * Recovery engine core — analyzes a failed payment with Gemini and dispatches
 * personalised recovery messages via connected channels (email / WhatsApp).
 *
 * Server-only. Callers: Stripe webhook route + retry server function.
 */

import { generateText, Output } from "ai";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableGateway, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { decryptJSON } from "@/lib/crypto.server";
import { sendEmailViaResend, sendWhatsAppText } from "./dispatch.server";
import { classifyFailure } from "./classify.server";
import {
  decideRecovery,
  DEFAULT_AUTOMATION,
  type AutomationSettings,
} from "./decide.server";
import { matchTemplate, type TemplateRow as MatchTemplateRow } from "./match-template.server";

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

const AnalysisSchema = z.object({
  category: z.enum([
    "insufficient_funds",
    "expired_card",
    "card_declined",
    "authentication_required",
    "fraud_suspected",
    "processor_error",
    "other",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  summary: z.string().max(280),
  next_action: z.enum([
    "retry_later",
    "ask_update_card",
    "ask_authenticate",
    "contact_support",
    "abandon",
  ]),
  email_subject: z.string().max(120),
  email_body: z.string().max(1800),
  whatsapp_text: z.string().max(700),
});

export type RecoveryAnalysis = z.infer<typeof AnalysisSchema>;

interface AnalyzeInput {
  failure_code: string | null;
  failure_message: string | null;
  amount_cents: number | null;
  currency: string | null;
  customer_name: string | null;
  customer_email: string | null;
  business_name: string | null;
  update_payment_url?: string | null;
}

export async function analyzeFailure(input: AnalyzeInput): Promise<RecoveryAnalysis> {
  const gateway = createLovableGateway();
  const model = gateway(DEFAULT_CHAT_MODEL);

  const amount =
    input.amount_cents != null && input.currency
      ? `${(input.amount_cents / 100).toFixed(2)} ${input.currency.toUpperCase()}`
      : "the outstanding amount";

  const prompt = `You are the recovery specialist for ${input.business_name ?? "an online business"}.
A payment just failed. Analyse the failure and draft warm, concise recovery messages the customer will actually respond to.

Failure code: ${input.failure_code ?? "unknown"}
Failure message: ${input.failure_message ?? "unknown"}
Amount: ${amount}
Customer name: ${input.customer_name ?? "there"}
Customer email: ${input.customer_email ?? "unknown"}
${input.update_payment_url ? `Payment update link: ${input.update_payment_url}` : ""}

Rules:
- Address the customer by first name when available, otherwise "Hi there".
- Never blame the customer. Be helpful, short, human.
- Email body: plain text, 3 short paragraphs max, sign as "${input.business_name ?? "The team"}".
- WhatsApp text: 1–2 sentences, casual but professional. If a link is available, include it.
- Do NOT include the amount if it's unknown.
- Never include placeholders like {name} — write finished copy.`;

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: AnalysisSchema }),
      prompt,
    });
    return output;
  } catch (err) {
    // Deterministic fallback so the engine never blocks on an AI outage.
    const name = input.customer_name?.split(" ")[0] ?? "there";
    return {
      category: "other",
      severity: "medium",
      summary: input.failure_message ?? "Payment could not be processed.",
      next_action: "ask_update_card",
      email_subject: `Quick heads up about your recent payment`,
      email_body:
        `Hi ${name},\n\nWe tried to process your recent payment but the bank returned an error.\n` +
        `Could you take a moment to update your payment method${input.update_payment_url ? ` here: ${input.update_payment_url}` : ""}? It only takes a minute.\n\n` +
        `Thanks so much,\n${input.business_name ?? "The team"}`,
      whatsapp_text:
        `Hi ${name}, quick note — your recent payment didn't go through. ` +
        (input.update_payment_url
          ? `You can update your card here: ${input.update_payment_url}`
          : "Could you take a look when you get a moment?"),
    };
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

type IntegrationRow = {
  id: string;
  provider: string;
  kind: string;
  status: string;
  config: Record<string, unknown> | null;
  credentials_ciphertext: string | null;
};

async function loadIntegrations(workspaceId: string): Promise<IntegrationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("id, provider, kind, status, config, credentials_ciphertext")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected");
  if (error) throw new Error(error.message);
  return (data ?? []) as IntegrationRow[];
}

function decryptCreds(row: IntegrationRow): Record<string, string> | null {
  if (!row.credentials_ciphertext) return null;
  try {
    return decryptJSON<Record<string, string>>(row.credentials_ciphertext);
  } catch {
    return null;
  }
}

interface RunRecoveryArgs {
  eventId: string;
}

/**
 * Analyse a recovery event, then dispatch recovery messages on every
 * connected communication channel. Idempotent per event+channel+step.
 */
/**
 * Cadence: run recovery messages at 0h / +1d / +3d / +7d after the initial failure.
 * When the array is exhausted the event is auto-abandoned.
 */
const CADENCE_HOURS = [0, 24, 72, 168];

function nextRunAt(nextStep: number): string | null {
  if (nextStep >= CADENCE_HOURS.length) return null;
  return new Date(Date.now() + CADENCE_HOURS[nextStep] * 3600_000).toISOString();
}

interface TemplateRow {
  step: number;
  channel: "email" | "whatsapp";
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  enabled: boolean;
}

async function loadTemplates(workspaceId: string, step: number): Promise<TemplateRow[]> {
  const { data } = await supabaseAdmin
    .from("recovery_templates")
    .select("step, channel, subject, body_text, body_html, enabled")
    .eq("workspace_id", workspaceId)
    .eq("step", step)
    .eq("enabled", true);
  return (data ?? []) as TemplateRow[];
}

export async function runRecoveryForEvent({ eventId }: RunRecoveryArgs): Promise<void> {
  const { data: event, error } = await supabaseAdmin
    .from("recovery_events")
    .select(
      "id, workspace_id, customer_id, amount_cents, currency, failure_code, failure_message, status, attempts_count, cadence_step, ai_analysis, raw",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) throw new Error("Recovery event not found.");
  if (event.status === "recovered" || event.status === "abandoned") return;

  const [{ data: customer }, { data: workspace }] = await Promise.all([
    event.customer_id
      ? supabaseAdmin
          .from("customers")
          .select("id, email, phone, name")
          .eq("id", event.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("workspaces")
      .select("id, name, organization_id, recovery_engine_enabled, status, trial_ends_at")
      .eq("id", event.workspace_id)
      .maybeSingle(),
  ]);
  if (!workspace) throw new Error("Workspace not found for event.");
  // Trial-expiry / subscription gate. Automation runs only when the workspace
  // is on an active paid plan, or on a trial that has not yet expired.
  const now = Date.now();
  const trialEnds = workspace.trial_ends_at ? new Date(workspace.trial_ends_at).getTime() : 0;
  const canSend =
    workspace.recovery_engine_enabled !== false &&
    (workspace.status === "active" || (workspace.status === "trial" && trialEnds > now));
  if (!canSend) {
    await supabaseAdmin
      .from("recovery_events")
      .update({ status: "abandoned", abandoned_at: new Date().toISOString() })
      .eq("id", event.id);
    return;
  }

  const currentStep = (event as { cadence_step?: number }).cadence_step ?? 0;

  await supabaseAdmin.from("recovery_events").update({ status: "analyzing" }).eq("id", event.id);

  const raw = (event.raw ?? {}) as Record<string, unknown>;
  const updateUrl =
    (raw.hosted_invoice_url as string | undefined) ??
    (raw.update_payment_url as string | undefined) ??
    null;

  const cached = (event.ai_analysis ?? null) as Partial<RecoveryAnalysis> | null;
  const analysis: RecoveryAnalysis =
    cached && cached.email_subject && cached.email_body && cached.whatsapp_text
      ? (cached as RecoveryAnalysis)
      : await analyzeFailure({
          failure_code: event.failure_code,
          failure_message: event.failure_message,
          amount_cents: event.amount_cents,
          currency: event.currency,
          customer_name: customer?.name ?? null,
          customer_email: customer?.email ?? null,
          business_name: workspace.name,
          update_payment_url: updateUrl,
        });

  await supabaseAdmin
    .from("recovery_events")
    .update({
      status: "recovering",
      failure_category: analysis.category,
      next_action: analysis.next_action,
      ai_summary: analysis.summary,
      ai_analysis: analysis as never,
    })
    .eq("id", event.id);

  const stepNumber = currentStep + 1;
  const templates = await loadTemplates(event.workspace_id, stepNumber);
  const emailTpl = templates.find((t) => t.channel === "email");
  const waTpl = templates.find((t) => t.channel === "whatsapp");

  const integrations = await loadIntegrations(event.workspace_id);
  const commIntegrations = integrations.filter((i) => i.kind === "communication");

  let anySent = false;

  for (const integ of commIntegrations) {
    const creds = decryptCreds(integ);
    if (!creds) continue;

    if (integ.provider === "resend" && customer?.email) {
      const subject = emailTpl?.subject ?? analysis.email_subject;
      const bodyText = emailTpl?.body_text ?? analysis.email_body;
      const bodyHtml = emailTpl?.body_html ?? undefined;

      const { data: attempt } = await supabaseAdmin
        .from("recovery_attempts")
        .insert({
          workspace_id: event.workspace_id,
          event_id: event.id,
          step: stepNumber,
          channel: "email",
          status: "sending",
          to_address: customer.email,
          subject,
          body_text: bodyText,
          body_html: bodyHtml ?? null,
          ai_model: DEFAULT_CHAT_MODEL,
        })
        .select("id")
        .single();

      const from_email = (integ.config?.["from_email"] as string | undefined) ?? creds.from_email;
      const from_name = (integ.config?.["from_name"] as string | undefined) ?? creds.from_name;
      const result = await sendEmailViaResend(
        { api_key: creds.api_key, from_email, from_name },
        { to: customer.email, subject, text: bodyText, html: bodyHtml },
      );

      await supabaseAdmin
        .from("recovery_attempts")
        .update({
          status: result.ok ? "sent" : "failed",
          provider_message_id: result.providerMessageId ?? null,
          provider_response: (result.raw ?? {}) as never,
          error: result.error ?? null,
          sent_at: result.ok ? new Date().toISOString() : null,
        })
        .eq("id", attempt!.id);

      anySent = anySent || result.ok;
    }

    if (integ.provider === "whatsapp_cloud" && customer?.phone) {
      const text = waTpl?.body_text ?? analysis.whatsapp_text;
      const { data: attempt } = await supabaseAdmin
        .from("recovery_attempts")
        .insert({
          workspace_id: event.workspace_id,
          event_id: event.id,
          step: stepNumber,
          channel: "whatsapp",
          status: "sending",
          to_address: customer.phone,
          body_text: text,
          ai_model: DEFAULT_CHAT_MODEL,
        })
        .select("id")
        .single();

      const phone_number_id =
        (integ.config?.["phone_number_id"] as string | undefined) ?? creds.phone_number_id;
      const result = await sendWhatsAppText(
        { access_token: creds.access_token, phone_number_id },
        { to: customer.phone, text },
      );

      await supabaseAdmin
        .from("recovery_attempts")
        .update({
          status: result.ok ? "sent" : "failed",
          provider_message_id: result.providerMessageId ?? null,
          provider_response: (result.raw ?? {}) as never,
          error: result.error ?? null,
          sent_at: result.ok ? new Date().toISOString() : null,
        })
        .eq("id", attempt!.id);

      anySent = anySent || result.ok;
    }
  }

  const nextAt = nextRunAt(stepNumber);
  const isLastStep = nextAt === null;

  await supabaseAdmin
    .from("recovery_events")
    .update({
      attempts_count: (event.attempts_count ?? 0) + 1,
      cadence_step: stepNumber,
      next_run_at: nextAt,
      status: isLastStep ? "abandoned" : anySent ? "recovering" : "failed",
      abandoned_at: isLastStep ? new Date().toISOString() : null,
    })
    .eq("id", event.id);
}

// ---------------------------------------------------------------------------
// Ingest a Stripe payment_intent.payment_failed / invoice.payment_failed event.
// ---------------------------------------------------------------------------

interface IngestArgs {
  workspaceId: string;
  externalEventId: string;
  objectType: "payment_intent" | "invoice" | "charge";
  object: Record<string, unknown>;
}

export async function ingestStripeFailure(args: IngestArgs): Promise<string | null> {
  const { workspaceId, externalEventId, objectType, object } = args;

  // Idempotency check first.
  const { data: existing } = await supabaseAdmin
    .from("recovery_events")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "stripe")
    .eq("external_event_id", externalEventId)
    .maybeSingle();
  if (existing) return existing.id;

  // Server-side usage enforcement — never trust the client.
  const { assertWithinUsageLimit, UsageLimitError } = await import("@/lib/usage-limits.server");
  try {
    await assertWithinUsageLimit(workspaceId);
  } catch (err) {
    if (err instanceof UsageLimitError) {
      console.warn(
        `[recovery] usage limit reached for workspace ${workspaceId}: ${err.used}/${err.limit}`,
      );
      return null;
    }
    throw err;
  }

  // Resolve customer identity from the Stripe object.
  const customerId =
    (object.customer as string | undefined) ??
    (object as { customer?: { id?: string } }).customer?.id ??
    null;
  const email =
    (object.receipt_email as string | undefined) ??
    (
      object as {
        charges?: {
          data?: Array<{ billing_details?: { email?: string; name?: string; phone?: string } }>;
        };
      }
    ).charges?.data?.[0]?.billing_details?.email ??
    (object.customer_email as string | undefined) ??
    null;
  const name =
    (object as { charges?: { data?: Array<{ billing_details?: { name?: string } }> } }).charges
      ?.data?.[0]?.billing_details?.name ??
    (object.customer_name as string | undefined) ??
    null;
  const phone =
    (object as { charges?: { data?: Array<{ billing_details?: { phone?: string } }> } }).charges
      ?.data?.[0]?.billing_details?.phone ?? null;

  let customerRowId: string | null = null;
  if (customerId || email) {
    const { data: cust } = await supabaseAdmin
      .from("customers")
      .upsert(
        {
          workspace_id: workspaceId,
          provider: "stripe",
          external_id: customerId,
          email,
          name,
          phone,
        },
        { onConflict: "workspace_id,provider,external_id" },
      )
      .select("id")
      .single();
    customerRowId = cust?.id ?? null;
  }

  const amountCents =
    (object.amount_due as number | undefined) ??
    (object.amount as number | undefined) ??
    (object.amount_remaining as number | undefined) ??
    null;
  const currency = (object.currency as string | undefined) ?? null;

  const lastError =
    (object.last_payment_error as { code?: string; message?: string } | undefined) ?? undefined;
  const failure_code =
    (object.failure_code as string | undefined) ??
    lastError?.code ??
    (object as { charges?: { data?: Array<{ failure_code?: string }> } }).charges?.data?.[0]
      ?.failure_code ??
    null;
  const failure_message =
    (object.failure_message as string | undefined) ??
    lastError?.message ??
    (object as { charges?: { data?: Array<{ failure_message?: string }> } }).charges?.data?.[0]
      ?.failure_message ??
    null;

  const externalObjectId = (object.id as string | undefined) ?? null;

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("recovery_events")
    .insert({
      workspace_id: workspaceId,
      customer_id: customerRowId,
      provider: "stripe",
      external_event_id: externalEventId,
      external_object_id: externalObjectId,
      object_type: objectType,
      amount_cents: amountCents,
      currency,
      failure_code,
      failure_message,
      status: "new",
      cadence_step: 0,
      next_run_at: new Date().toISOString(),
      raw: object as never,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  return inserted.id;
}
