/**
 * Server-only adapter implementations. Each adapter knows how to validate
 * credentials against the upstream provider ("test") and expose a public
 * config snapshot for the frontend (never containing secrets).
 *
 * NEVER import this file from client-reachable modules. It is loaded inside
 * server-function handlers via dynamic `await import(...)`.
 */

import { createHash } from "node:crypto";

import { checkPublicHttpUrl } from "./url-guard.server";

export interface TestResult {
  ok: boolean;
  message: string;
  /** Public, non-secret metadata to persist in integrations.config. */
  publicConfig?: Record<string, unknown>;
}

export type AdapterCreds = Record<string, string | undefined>;

export interface Adapter {
  provider: string;
  test(creds: AdapterCreds): Promise<TestResult>;
}

function trimUrl(u: string | undefined): string {
  return (u ?? "").trim().replace(/\/+$/, "");
}

function short(body: string): string {
  return body.slice(0, 200).replace(/\s+/g, " ");
}

// ------------------------------------------------------------------ STORES
const shopifyAdapter: Adapter = {
  provider: "shopify",
  async test(creds) {
    const url = trimUrl(creds.store_url);
    const token = creds.admin_access_token?.trim();
    const version = (creds.api_version?.trim() || "2024-10").replace(/[^0-9-]/g, "");
    if (!url || !token)
      return { ok: false, message: "Store URL and Admin API token are required." };
    const urlErr = checkPublicHttpUrl(url);
    if (urlErr) return { ok: false, message: `Store URL rejected: ${urlErr}` };
    const res = await fetch(`${url}/admin/api/${version}/shop.json`, {
      headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `Shopify rejected the credentials (${res.status}). ${short(body)}`,
      };
    }
    const j = (await res.json().catch(() => ({}))) as {
      shop?: { name?: string; domain?: string; currency?: string; plan_name?: string };
    };
    return {
      ok: true,
      message: `Connected to Shopify store ${j.shop?.name ?? j.shop?.domain ?? url}.`,
      publicConfig: {
        store_url: url,
        api_version: version,
        shop_name: j.shop?.name,
        shop_domain: j.shop?.domain,
        currency: j.shop?.currency,
        plan_name: j.shop?.plan_name,
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

const wooCommerceAdapter: Adapter = {
  provider: "woocommerce",
  async test(creds) {
    const url = trimUrl(creds.store_url);
    const ck = creds.consumer_key?.trim();
    const cs = creds.consumer_secret?.trim();
    if (!url || !ck || !cs)
      return { ok: false, message: "Store URL, consumer key and secret are required." };
    const urlErr = checkPublicHttpUrl(url);
    if (urlErr) return { ok: false, message: `Store URL rejected: ${urlErr}` };
    const auth = Buffer.from(`${ck}:${cs}`).toString("base64");
    const res = await fetch(`${url}/wp-json/wc/v3/system_status`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `WooCommerce rejected the credentials (${res.status}). ${short(body)}`,
      };
    }
    const j = (await res.json().catch(() => ({}))) as {
      environment?: { site_url?: string; version?: string; currency?: string };
    };
    return {
      ok: true,
      message: `Connected to WooCommerce store ${j.environment?.site_url ?? url}.`,
      publicConfig: {
        store_url: url,
        wc_version: j.environment?.version,
        currency: j.environment?.currency,
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

const customStoreAdapter: Adapter = {
  provider: "custom_store",
  async test(creds) {
    const base = trimUrl(creds.base_url);
    const authType = creds.auth_type?.trim() || "bearer";
    const apiKey = creds.api_key?.trim();
    if (!base || !apiKey || !creds.store_name?.trim()) {
      return { ok: false, message: "Store name, base URL and API key are required." };
    }
    const baseErr = checkPublicHttpUrl(base);
    if (baseErr) return { ok: false, message: `Base URL rejected: ${baseErr}` };
    const headers: Record<string, string> = { Accept: "application/json" };
    if (authType === "bearer") headers.Authorization = `Bearer ${apiKey}`;
    else if (authType === "api_key") headers["X-API-Key"] = apiKey;
    else if (authType === "basic")
      headers.Authorization = `Basic ${Buffer.from(apiKey).toString("base64")}`;
    const res = await fetch(base, { headers });
    // Any non-5xx counts as reachable — custom endpoints often 404 the root.
    if (res.status >= 500) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `Store endpoint returned ${res.status}. ${short(body)}` };
    }
    return {
      ok: true,
      message: `Reached ${creds.store_name} at ${base} (HTTP ${res.status}).`,
      publicConfig: {
        store_name: creds.store_name,
        base_url: base,
        auth_type: authType,
        webhook_endpoint: creds.webhook_endpoint ?? null,
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

// ---------------------------------------------------------- PAYMENT GATEWAYS
const stripeAdapter: Adapter = {
  provider: "stripe",
  async test(creds) {
    const key = creds.secret_key?.trim();
    if (!key) return { ok: false, message: "Missing Stripe secret key." };
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `Stripe rejected the key (${res.status}). ${short(body)}` };
    }
    const acct = (await res.json()) as {
      id?: string;
      email?: string;
      country?: string;
      default_currency?: string;
      business_profile?: { name?: string };
    };
    return {
      ok: true,
      message: `Connected to Stripe account ${acct.business_profile?.name ?? acct.id}.`,
      publicConfig: {
        account_id: acct.id,
        account_email: acct.email,
        country: acct.country,
        default_currency: acct.default_currency,
        livemode: key.startsWith("sk_live_"),
        publishable_key: creds.publishable_key ?? null,
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

const paypalAdapter: Adapter = {
  provider: "paypal",
  async test(creds) {
    const id = creds.client_id?.trim();
    const secret = creds.client_secret?.trim();
    const env = creds.environment?.trim() === "live" ? "live" : "sandbox";
    if (!id || !secret) return { ok: false, message: "Client ID and client secret are required." };
    const base = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `PayPal rejected the credentials (${res.status}). ${short(body)}`,
      };
    }
    const j = (await res.json()) as { app_id?: string; scope?: string; expires_in?: number };
    return {
      ok: true,
      message: `Connected to PayPal (${env}).`,
      publicConfig: {
        environment: env,
        app_id: j.app_id,
        scope: j.scope,
      },
    };
  },
};

const paddleAdapter: Adapter = {
  provider: "paddle",
  async test(creds) {
    const key = creds.api_key?.trim();
    const env = creds.environment?.trim() === "sandbox" ? "sandbox" : "live";
    if (!key) return { ok: false, message: "Paddle API key is required." };
    const base = env === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
    const res = await fetch(`${base}/event-types`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `Paddle rejected the key (${res.status}). ${short(body)}` };
    }
    return {
      ok: true,
      message: `Connected to Paddle (${env}).`,
      publicConfig: { environment: env, has_webhook_secret: Boolean(creds.webhook_secret) },
    };
  },
};

const lemonSqueezyAdapter: Adapter = {
  provider: "lemonsqueezy",
  async test(creds) {
    const key = creds.api_key?.trim();
    const storeId = creds.store_id?.trim();
    if (!key || !storeId) return { ok: false, message: "API key and Store ID are required." };
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/stores/${encodeURIComponent(storeId)}`,
      {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json" },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `Lemon Squeezy rejected the credentials (${res.status}). ${short(body)}`,
      };
    }
    const j = (await res.json()) as {
      data?: { attributes?: { name?: string; domain?: string; currency?: string } };
    };
    return {
      ok: true,
      message: `Connected to Lemon Squeezy store ${j.data?.attributes?.name ?? storeId}.`,
      publicConfig: {
        store_id: storeId,
        store_name: j.data?.attributes?.name,
        domain: j.data?.attributes?.domain,
        currency: j.data?.attributes?.currency,
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

const adyenAdapter: Adapter = {
  provider: "adyen",
  async test(creds) {
    const key = creds.api_key?.trim();
    const merchant = creds.merchant_account?.trim();
    const env = creds.environment?.trim() === "live" ? "live" : "test";
    if (!key || !merchant)
      return { ok: false, message: "API key and merchant account are required." };
    const base =
      env === "live"
        ? "https://checkout-live.adyen.com/v71"
        : "https://checkout-test.adyen.com/v71";
    // paymentMethods is the standard health-check endpoint for Adyen Checkout.
    const res = await fetch(`${base}/paymentMethods`, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ merchantAccount: merchant }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `Adyen rejected the credentials (${res.status}). ${short(body)}`,
      };
    }
    return {
      ok: true,
      message: `Connected to Adyen (${env}) merchant ${merchant}.`,
      publicConfig: {
        environment: env,
        merchant_account: merchant,
        has_hmac_key: Boolean(creds.hmac_key),
      },
    };
  },
};

const customGatewayAdapter: Adapter = {
  provider: "custom_gateway",
  async test(creds) {
    const endpoint = trimUrl(creds.api_endpoint);
    const key = creds.api_key?.trim();
    if (!endpoint || !key || !creds.gateway_name?.trim()) {
      return { ok: false, message: "Gateway name, API endpoint and API key are required." };
    }
    const endpointErr = checkPublicHttpUrl(endpoint);
    if (endpointErr) return { ok: false, message: `API endpoint rejected: ${endpointErr}` };
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (res.status >= 500) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `Gateway endpoint returned ${res.status}. ${short(body)}` };
    }
    return {
      ok: true,
      message: `Reached ${creds.gateway_name} at ${endpoint} (HTTP ${res.status}).`,
      publicConfig: {
        gateway_name: creds.gateway_name,
        api_endpoint: endpoint,
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

// -------------------------------------------------------------- COMMUNICATION
const resendAdapter: Adapter = {
  provider: "resend",
  async test(creds) {
    const key = creds.api_key?.trim();
    const from = creds.from_email?.trim();
    if (!key) return { ok: false, message: "Missing Resend API key." };
    if (!from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
      return { ok: false, message: "A valid From address is required." };
    }
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `Resend rejected the key (${res.status}). ${short(body)}` };
    }
    const json = (await res.json()) as { data?: Array<{ name?: string; status?: string }> };
    const domains = json.data ?? [];
    const fromDomain = from.split("@")[1]?.toLowerCase();
    const match = domains.find((d) => d.name?.toLowerCase() === fromDomain);
    if (!match) {
      return {
        ok: false,
        message: `Sending domain "${fromDomain}" is not in your Resend account. Verify it first.`,
      };
    }
    if (match.status && match.status !== "verified") {
      return {
        ok: false,
        message: `Domain "${fromDomain}" is not verified in Resend (status: ${match.status}).`,
      };
    }
    return {
      ok: true,
      message: `Verified sender ${from}.`,
      publicConfig: {
        from_email: from,
        from_name: creds.from_name ?? null,
        domain: fromDomain,
        domain_status: match.status ?? "verified",
      },
    };
  },
};

const sendgridAdapter: Adapter = {
  provider: "sendgrid",
  async test(creds) {
    const key = creds.api_key?.trim();
    const from = creds.from_email?.trim();
    if (!key) return { ok: false, message: "Missing SendGrid API key." };
    if (!from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
      return { ok: false, message: "A valid From address is required." };
    }
    const res = await fetch("https://api.sendgrid.com/v3/scopes", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `SendGrid rejected the key (${res.status}). ${short(body)}` };
    }
    const j = (await res.json()) as { scopes?: string[] };
    const canSend = (j.scopes ?? []).some(
      (s) => s === "mail.send" || s === "sender_verification_eligible" || s.startsWith("mail."),
    );
    if (!canSend) {
      return { ok: false, message: "SendGrid API key does not include mail.send scope." };
    }
    return {
      ok: true,
      message: `Verified SendGrid key for ${from}.`,
      publicConfig: {
        from_email: from,
        from_name: creds.from_name ?? null,
      },
    };
  },
};

const smtpAdapter: Adapter = {
  provider: "smtp",
  async test(creds) {
    // We can't open raw TCP sockets from the Worker runtime, so we validate
    // shape only and persist non-secret config. Actual sends happen at
    // dispatch time and will surface errors then.
    const host = creds.host?.trim();
    const port = Number(creds.port);
    const from = creds.from_email?.trim();
    if (!host || !port || !creds.username?.trim() || !creds.password?.trim() || !from) {
      return {
        ok: false,
        message: "Host, port, username, password and from address are required.",
      };
    }
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return { ok: false, message: "Port must be between 1 and 65535." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
      return { ok: false, message: "A valid From address is required." };
    }
    return {
      ok: true,
      message: `SMTP settings saved for ${host}:${port}.`,
      publicConfig: {
        host,
        port,
        username: creds.username,
        from_email: from,
        from_name: creds.from_name ?? null,
        secure: creds.secure ?? "starttls",
      },
    };
  },
};

const whatsappCloudAdapter: Adapter = {
  provider: "whatsapp_cloud",
  async test(creds) {
    const token = creds.access_token?.trim();
    const phoneId = creds.phone_number_id?.trim();
    if (!token || !phoneId) {
      return { ok: false, message: "Access token and phone number ID are required." };
    }
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `Meta rejected the credentials (${res.status}). ${short(body)}`,
      };
    }
    const j = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
    };
    return {
      ok: true,
      message: `Connected to ${j.verified_name ?? j.display_phone_number ?? "WhatsApp number"}.`,
      publicConfig: {
        phone_number_id: phoneId,
        waba_id: creds.waba_id ?? null,
        display_phone_number: j.display_phone_number,
        verified_name: j.verified_name,
        quality_rating: j.quality_rating,
        verify_token_fingerprint: creds.verify_token
          ? createHash("sha256").update(creds.verify_token).digest("hex").slice(0, 12)
          : null,
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

import {
  eddAdapter,
  memberpressAdapter,
  surecartAdapter,
  mailgunAdapter,
  postmarkAdapter,
  metaWhatsAppAdapter,
  twilioSmsAdapter,
  twilioWhatsAppAdapter,
} from "@/lib/providers/registry-stubs.server";

const REGISTRY: Record<string, Adapter> = {
  shopify: shopifyAdapter,
  woocommerce: wooCommerceAdapter,
  custom_store: customStoreAdapter,
  edd: eddAdapter,
  memberpress: memberpressAdapter,
  surecart: surecartAdapter,
  stripe: stripeAdapter,
  paypal: paypalAdapter,
  paddle: paddleAdapter,
  lemonsqueezy: lemonSqueezyAdapter,
  adyen: adyenAdapter,
  custom_gateway: customGatewayAdapter,
  resend: resendAdapter,
  sendgrid: sendgridAdapter,
  smtp: smtpAdapter,
  mailgun: mailgunAdapter,
  postmark: postmarkAdapter,
  meta_wa: metaWhatsAppAdapter,
  whatsapp_cloud: metaWhatsAppAdapter, // legacy alias
  twilio_sms: twilioSmsAdapter,
  twilio_wa: twilioWhatsAppAdapter,
};

export function getAdapter(provider: string): Adapter {
  const a = REGISTRY[provider];
  if (!a) throw new Error(`Unknown integration provider: ${provider}`);
  return a;
}
