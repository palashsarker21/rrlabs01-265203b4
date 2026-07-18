/**
 * Billing notifications — payment failed, cancellation warning, payment recovered.
 *
 * Records every notification in `notification_logs` (audit + admin dashboard).
 * If the Lovable email template registry is scaffolded, sends via
 * `sendTemplateEmail`; otherwise logs to console with `status='skipped'` so
 * the platform remains operational until email templates are configured.
 *
 * Server-only.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BillingNotificationKind =
  | "payment_failed"
  | "cancellation_warning"
  | "payment_recovered"
  | "trial_ending"
  | "subscription_cancelled";

type SendArgs = {
  kind: BillingNotificationKind;
  workspaceId: string;
  subscriptionId?: string | null;
  recipient?: string | null;
  data?: Record<string, unknown>;
};

async function resolveOwnerEmail(workspaceId: string): Promise<string | null> {
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("organization_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws?.organization_id) return null;
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("billing_email, owner_id")
    .eq("id", ws.organization_id)
    .maybeSingle();
  if (org?.billing_email) return org.billing_email;
  if (!org?.owner_id) return null;
  const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(org.owner_id);
  return userInfo.user?.email ?? null;
}

async function trySendEmail(
  kind: BillingNotificationKind,
  recipient: string,
  workspaceId: string,
  data: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  try {
    const { sendEmail } = await import("@/lib/email/service.server");
    // Map billing kind → registry template
    const templateMap: Record<BillingNotificationKind, string> = {
      payment_failed: "payment-failed",
      cancellation_warning: "payment-failed",
      payment_recovered: "payment-successful",
      trial_ending: "trial-ending",
      subscription_cancelled: "system-alert",
    };
    const template = templateMap[kind] as
      | "payment-failed"
      | "payment-successful"
      | "trial-ending"
      | "system-alert";

    // Best-effort default template data — callers may override via `data`.
    const baseData: Record<string, unknown> =
      template === "system-alert"
        ? {
            title: "Subscription cancelled",
            message: "Your RRLabs subscription has been cancelled.",
            severity: "warning" as const,
            actionUrl: "https://rrlabs.online/app/billing",
          }
        : template === "trial-ending"
          ? { daysLeft: 3, upgradeUrl: "https://rrlabs.online/app/upgrade" }
          : template === "payment-failed"
            ? { updateUrl: "https://rrlabs.online/app/billing", gracePeriodDays: 7 }
            : { amountFormatted: (data.amount_formatted as string) ?? "" };

    const result = await sendEmail({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      template: template as any,
      to: recipient,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...baseData, ...data } as any,
      workspaceId,
      idempotencyKey: `${kind}-${(data.event_id as string) ?? Date.now()}`,
      metadata: { kind, source: "billing" },
    });
    if (result.ok) return { ok: true };
    return {
      ok: false,
      error: result.error,
      skipped: result.code === "unconfigured",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendBillingNotification(args: SendArgs): Promise<void> {
  const recipient = args.recipient ?? (await resolveOwnerEmail(args.workspaceId));
  const payload = { ...(args.data ?? {}), kind: args.kind };

  if (!recipient) {
    await supabaseAdmin.from("notification_logs").insert({
      workspace_id: args.workspaceId,
      subscription_id: args.subscriptionId ?? null,
      kind: args.kind,
      channel: "email",
      recipient: null,
      status: "no_recipient",
      payload,
    });
    return;
  }

  const result = await trySendEmail(args.kind, recipient, payload);
  await supabaseAdmin.from("notification_logs").insert({
    workspace_id: args.workspaceId,
    subscription_id: args.subscriptionId ?? null,
    kind: args.kind,
    channel: "email",
    recipient,
    status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
    error: result.ok ? null : result.error,
    payload,
  });

  if (!result.ok && !result.skipped) {
    console.error(`[billing-notification] ${args.kind} failed:`, result.error);
  }
}
