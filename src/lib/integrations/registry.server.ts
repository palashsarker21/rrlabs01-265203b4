/**
 * Server-only adapter implementations. Each adapter knows how to validate
 * credentials against the upstream provider ("test") and expose a public
 * config snapshot for the frontend (never containing secrets).
 *
 * NEVER import this file from client-reachable modules. It is loaded inside
 * server-function handlers via dynamic `await import(...)`.
 */

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

// -------- Stripe --------
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
      return { ok: false, message: `Stripe rejected the key (${res.status}). ${body.slice(0, 160)}` };
    }
    const acct = (await res.json()) as {
      id?: string;
      email?: string;
      country?: string;
      default_currency?: string;
      livemode?: boolean;
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
        has_webhook_secret: Boolean(creds.webhook_secret),
      },
    };
  },
};

// -------- Resend --------
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
      return { ok: false, message: `Resend rejected the key (${res.status}). ${body.slice(0, 160)}` };
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

// -------- WhatsApp Cloud (Meta) --------
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
        message: `Meta rejected the credentials (${res.status}). ${body.slice(0, 200)}`,
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
      },
    };
  },
};

const REGISTRY: Record<string, Adapter> = {
  stripe: stripeAdapter,
  resend: resendAdapter,
  whatsapp_cloud: whatsappCloudAdapter,
};

export function getAdapter(provider: string): Adapter {
  const a = REGISTRY[provider];
  if (!a) throw new Error(`Unknown integration provider: ${provider}`);
  return a;
}
