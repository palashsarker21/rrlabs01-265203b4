import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

import { slugify, randomSuffix } from "@/lib/slug";

/**
 * Lemon Squeezy webhook.
 *
 * Configure in the Lemon Squeezy dashboard (Settings → Webhooks):
 *   URL:    https://<your-project>.lovable.app/api/public/webhooks/lemonsqueezy
 *   Secret: value stored in LEMONSQUEEZY_WEBHOOK_SECRET
 *   Events: order_created, subscription_created, subscription_updated,
 *           subscription_cancelled, subscription_resumed, subscription_expired,
 *           subscription_paused, subscription_unpaused, subscription_payment_success,
 *           subscription_payment_failed
 */
export const Route = createFileRoute("/api/public/webhooks/lemonsqueezy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
        if (!secret) {
          console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured");
          return new Response("Server misconfigured", { status: 500 });
        }

        const signature = request.headers.get("x-signature") ?? "";
        const raw = await request.text();

        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: LSWebhookPayload;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventName = payload.meta?.event_name;
        const eventId = request.headers.get("x-event-id") ?? payload.meta?.webhook_id ?? undefined;
        if (!eventName) {
          return new Response("Missing event name", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: skip if we've already processed this event.
        if (eventId) {
          const { data: existing } = await supabaseAdmin
            .from("billing_events")
            .select("id, processed_at")
            .eq("provider", "lemonsqueezy")
            .eq("event_id", eventId)
            .maybeSingle();
          if (existing?.processed_at) {
            return new Response("ok", { status: 200 });
          }
        }

        const { data: eventRow } = await supabaseAdmin
          .from("billing_events")
          .upsert(
            {
              provider: "lemonsqueezy",
              event_name: eventName,
              event_id: eventId ?? null,
              payload: payload as never,
            },
            { onConflict: "provider,event_id" },
          )
          .select("id")
          .single();

        try {
          await dispatch(eventName, payload);
          if (eventRow?.id) {
            await supabaseAdmin
              .from("billing_events")
              .update({ processed_at: new Date().toISOString() })
              .eq("id", eventRow.id);
          }
          return new Response("ok", { status: 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[lemonsqueezy webhook] handler failed", eventName, message);
          if (eventRow?.id) {
            await supabaseAdmin
              .from("billing_events")
              .update({ error: message })
              .eq("id", eventRow.id);
          }
          // 500 → Lemon Squeezy will retry.
          return new Response("Handler error", { status: 500 });
        }
      },
    },
  },
});

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type LSWebhookPayload = {
  meta?: {
    event_name?: string;
    webhook_id?: string;
    custom_data?: Record<string, string | number | boolean | null | undefined>;
  };
  data?: {
    id?: string;
    type?: string;
    attributes?: Record<string, unknown>;
  };
};

type SubscriptionStatus =
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  on_trial: "on_trial",
  active: "active",
  paused: "paused",
  past_due: "past_due",
  unpaid: "unpaid",
  cancelled: "cancelled",
  expired: "expired",
};

// -------------------------------------------------------------------------
// Dispatch
// -------------------------------------------------------------------------

async function dispatch(eventName: string, payload: LSWebhookPayload): Promise<void> {
  switch (eventName) {
    case "subscription_created":
      await onSubscriptionCreated(payload);
      break;
    case "subscription_updated":
    case "subscription_resumed":
    case "subscription_unpaused":
    case "subscription_paused":
    case "subscription_cancelled":
    case "subscription_expired":
    case "subscription_payment_success":
    case "subscription_payment_failed":
      await onSubscriptionUpdated(payload);
      break;
    case "order_created":
      // No-op for subscription flow; kept for audit.
      break;
    default:
      // Recorded to billing_events but no domain action needed.
      break;
  }
}

async function onSubscriptionCreated(payload: LSWebhookPayload): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const attr = (payload.data?.attributes ?? {}) as Record<string, unknown>;
  const lsSubscriptionId = String(payload.data?.id ?? "");
  if (!lsSubscriptionId) throw new Error("Missing subscription id");

  const custom = (payload.meta?.custom_data ?? {}) as Record<string, string>;
  const checkoutSessionId = custom.checkout_session_id;
  const userIdFromCustom = custom.user_id;
  const planIdFromCustom = custom.plan_id;

  // Fetch the checkout session (source of workspace/org names)
  let session: {
    id: string;
    user_id: string;
    plan_id: string;
    workspace_name: string;
    organization_name: string;
    fulfilled_workspace_id: string | null;
  } | null = null;
  if (checkoutSessionId) {
    const { data } = await supabaseAdmin
      .from("checkout_sessions")
      .select("id, user_id, plan_id, workspace_name, organization_name, fulfilled_workspace_id")
      .eq("id", checkoutSessionId)
      .maybeSingle();
    session = data ?? null;
  }

  const userId = session?.user_id ?? userIdFromCustom;
  const planId = session?.plan_id ?? planIdFromCustom;
  if (!userId || !planId) throw new Error("Missing user_id / plan_id in webhook custom data");

  // Provision workspace only if not already fulfilled.
  let workspaceId = session?.fulfilled_workspace_id ?? null;
  if (!workspaceId) {
    const orgName = session?.organization_name ?? "My Company";
    const wsName = session?.workspace_name ?? "Default";
    const orgSlug = `${slugify(orgName)}-${randomSuffix()}`;
    const wsSlug = `${slugify(wsName)}-${randomSuffix()}`;

    // Fetch billing email from auth admin
    let billingEmail: string | undefined = attr.user_email as string | undefined;
    if (!billingEmail) {
      const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(userId);
      billingEmail = userInfo.user?.email ?? undefined;
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        slug: orgSlug,
        name: orgName,
        owner_id: userId,
        billing_email: billingEmail,
      })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Could not create organization");

    const { data: ws, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .insert({
        organization_id: org.id,
        slug: wsSlug,
        name: wsName,
        status: "setup",
        setup_step: 0,
      })
      .select("id")
      .single();
    if (wsErr || !ws) throw new Error(wsErr?.message ?? "Could not create workspace");

    await supabaseAdmin.from("workspace_members").insert({
      workspace_id: ws.id,
      user_id: userId,
      role: "owner",
    });

    workspaceId = ws.id;

    if (session) {
      await supabaseAdmin
        .from("checkout_sessions")
        .update({ fulfilled_workspace_id: workspaceId, status: "completed" })
        .eq("id", session.id);
    }
  }

  const statusStr = String(attr.status ?? "on_trial");
  const status: SubscriptionStatus = STATUS_MAP[statusStr] ?? "on_trial";

  await supabaseAdmin.from("subscriptions").upsert(
    {
      workspace_id: workspaceId!,
      plan_id: planId,
      ls_subscription_id: lsSubscriptionId,
      ls_customer_id: attr.customer_id ? String(attr.customer_id) : null,
      ls_order_id: attr.order_id ? String(attr.order_id) : null,
      ls_variant_id: attr.variant_id ? String(attr.variant_id) : null,
      status,
      trial_ends_at: asDate(attr.trial_ends_at),
      renews_at: asDate(attr.renews_at),
      ends_at: asDate(attr.ends_at),
      update_payment_url: extractUrl(attr, "update_payment_method"),
      customer_portal_url: extractUrl(attr, "customer_portal"),
      card_brand: (attr.card_brand as string | null) ?? null,
      card_last_four: (attr.card_last_four as string | null) ?? null,
      raw: attr as never,
    },
    { onConflict: "ls_subscription_id" },
  );

  await supabaseAdmin
    .from("workspaces")
    .update({
      subscription_id: lsSubscriptionId,
      subscription_status: status,
      trial_ends_at: asDate(attr.trial_ends_at),
    })
    .eq("id", workspaceId!);
}

async function onSubscriptionUpdated(payload: LSWebhookPayload): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const attr = (payload.data?.attributes ?? {}) as Record<string, unknown>;
  const lsSubscriptionId = String(payload.data?.id ?? "");
  if (!lsSubscriptionId) throw new Error("Missing subscription id");

  const eventName = payload.meta?.event_name ?? "";
  const statusStr = String(attr.status ?? "");
  let status: SubscriptionStatus | undefined = STATUS_MAP[statusStr];

  // Event-name overrides for accuracy when `attr.status` lags.
  if (eventName === "subscription_payment_failed") status = "past_due";
  if (eventName === "subscription_paused") status = "paused";
  if (eventName === "subscription_unpaused") status = status ?? "active";
  if (eventName === "subscription_resumed") status = "active";
  if (eventName === "subscription_cancelled") status = "cancelled";
  if (eventName === "subscription_expired") status = "expired";

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, workspace_id")
    .eq("ls_subscription_id", lsSubscriptionId)
    .maybeSingle();

  await supabaseAdmin
    .from("subscriptions")
    .update({
      ...(status ? { status } : {}),
      trial_ends_at: asDate(attr.trial_ends_at),
      renews_at: asDate(attr.renews_at),
      ends_at: asDate(attr.ends_at),
      cancelled_at: attr.cancelled || status === "cancelled" ? new Date().toISOString() : null,
      update_payment_url: extractUrl(attr, "update_payment_method"),
      customer_portal_url: extractUrl(attr, "customer_portal"),
      card_brand: (attr.card_brand as string | null) ?? null,
      card_last_four: (attr.card_last_four as string | null) ?? null,
      raw: attr as never,
    })
    .eq("ls_subscription_id", lsSubscriptionId);

  if (sub?.workspace_id && status) {
    const wsStatus =
      status === "cancelled" || status === "expired"
        ? "cancelled"
        : status === "past_due" || status === "unpaid" || status === "paused"
          ? "suspended"
          : status === "active" || status === "on_trial"
            ? "active"
            : undefined;

    const engineChange =
      status === "active" || status === "on_trial"
        ? {}
        : { recovery_engine_enabled: false };

    await supabaseAdmin
      .from("workspaces")
      .update({
        subscription_status: status,
        ...(wsStatus ? { status: wsStatus } : {}),
        ...engineChange,
      })
      .eq("id", sub.workspace_id);
  }

  // Fire billing notifications for terminal / recovery events.
  if (sub?.workspace_id) {
    const eventId = payload.meta?.webhook_id ?? String(payload.data?.id ?? "");
    const { sendBillingNotification } = await import("@/lib/billing-notifications.server");
    const commonData = {
      event_id: eventId,
      update_payment_url: extractUrl(attr, "update_payment_method"),
      customer_portal_url: extractUrl(attr, "customer_portal"),
      ends_at: asDate(attr.ends_at),
      renews_at: asDate(attr.renews_at),
    };
    if (eventName === "subscription_payment_failed") {
      await sendBillingNotification({
        kind: "payment_failed",
        workspaceId: sub.workspace_id,
        subscriptionId: sub.id,
        data: commonData,
      });
    } else if (eventName === "subscription_payment_success" && status === "active") {
      // Send only when the previous status was past_due (recovery).
      const prevStatus = (attr as { previous_status?: string }).previous_status;
      if (prevStatus === "past_due" || prevStatus === "unpaid") {
        await sendBillingNotification({
          kind: "payment_recovered",
          workspaceId: sub.workspace_id,
          subscriptionId: sub.id,
          data: commonData,
        });
      }
    } else if (eventName === "subscription_cancelled") {
      await sendBillingNotification({
        kind: "cancellation_warning",
        workspaceId: sub.workspace_id,
        subscriptionId: sub.id,
        data: commonData,
      });
    } else if (eventName === "subscription_expired") {
      await sendBillingNotification({
        kind: "subscription_cancelled",
        workspaceId: sub.workspace_id,
        subscriptionId: sub.id,
        data: commonData,
      });
    }
  }
}


function asDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function extractUrl(attr: Record<string, unknown>, key: string): string | null {
  const urls = attr.urls as Record<string, string> | undefined;
  return urls?.[key] ?? null;
}
