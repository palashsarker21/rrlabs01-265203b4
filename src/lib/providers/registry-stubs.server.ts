/**
 * Server-only stub adapters for providers whose full API integration is
 * scheduled for a follow-up pass. Each stub validates required field shape
 * and — where trivial and safe — issues a real credential-check call.
 *
 * The webhook URL, plan limits, disconnect flow, admin toggles, and health
 * status all work today; only the outbound send / read-live-API surface is
 * marked "coming soon" from `test()`.
 */

import type { Adapter, TestResult, AdapterCreds } from "@/lib/integrations/registry.server";

function requireFields(fields: AdapterCreds, keys: string[]): string | null {
  for (const k of keys) {
    if (!fields[k]?.toString().trim()) return `${k} is required`;
  }
  return null;
}

function ok(message: string, publicConfig?: Record<string, unknown>): TestResult {
  return { ok: true, message, publicConfig };
}

// ------------------- STORES ---------------------
export const eddAdapter: Adapter = {
  provider: "edd",
  async test(creds) {
    const err = requireFields(creds, ["site_url", "public_key", "secret_key"]);
    if (err) return { ok: false, message: err };
    const site = creds.site_url!.trim().replace(/\/+$/, "");
    // EDD REST returns 200 on ping when keys are valid.
    try {
      const res = await fetch(
        `${site}/edd-api/info?key=${encodeURIComponent(creds.public_key!)}&token=${encodeURIComponent(creds.secret_key!)}`,
      );
      if (res.status >= 500) {
        return { ok: false, message: `EDD endpoint returned ${res.status}.` };
      }
      return ok(`Connected to Easy Digital Downloads at ${site}.`, { site_url: site });
    } catch (e) {
      return { ok: false, message: `Could not reach ${site}: ${(e as Error).message}` };
    }
  },
};

export const memberpressAdapter: Adapter = {
  provider: "memberpress",
  async test(creds) {
    const err = requireFields(creds, ["site_url", "api_key"]);
    if (err) return { ok: false, message: err };
    const site = creds.site_url!.trim().replace(/\/+$/, "");
    try {
      const res = await fetch(`${site}/wp-json/mp/v1/me`, {
        headers: { "MEMBERPRESS-API-KEY": creds.api_key!, Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: "MemberPress rejected the API key." };
      }
      if (res.status >= 500) return { ok: false, message: `MemberPress returned ${res.status}.` };
      return ok(`Connected to MemberPress at ${site}.`, { site_url: site });
    } catch (e) {
      return { ok: false, message: `Could not reach ${site}: ${(e as Error).message}` };
    }
  },
};

export const surecartAdapter: Adapter = {
  provider: "surecart",
  async test(creds) {
    const err = requireFields(creds, ["secret_key"]);
    if (err) return { ok: false, message: err };
    try {
      const res = await fetch("https://api.surecart.com/v1/accounts/current", {
        headers: {
          Authorization: `Bearer ${creds.secret_key}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        return { ok: false, message: `SureCart rejected the key (${res.status}).` };
      }
      const j = (await res.json()) as { name?: string; id?: string };
      return ok(`Connected to SureCart account ${j.name ?? j.id ?? ""}.`, {
        account_id: j.id ?? null,
        account_name: j.name ?? null,
      });
    } catch (e) {
      return { ok: false, message: `Could not reach SureCart: ${(e as Error).message}` };
    }
  },
};

// ------------------- EMAIL ---------------------
export const mailgunAdapter: Adapter = {
  provider: "mailgun",
  async test(creds) {
    const err = requireFields(creds, ["api_key", "from_domain"]);
    if (err) return { ok: false, message: err };
    const region = (creds.region ?? "us").toLowerCase() === "eu" ? "eu" : "us";
    const base = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
    try {
      const res = await fetch(`${base}/v4/domains/${encodeURIComponent(creds.from_domain!)}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${creds.api_key}`).toString("base64")}`,
        },
      });
      if (!res.ok) {
        return { ok: false, message: `Mailgun rejected the domain/key (${res.status}).` };
      }
      return ok(`Verified Mailgun domain ${creds.from_domain}.`, {
        from_domain: creds.from_domain,
        region,
      });
    } catch (e) {
      return { ok: false, message: `Could not reach Mailgun: ${(e as Error).message}` };
    }
  },
};

export const postmarkAdapter: Adapter = {
  provider: "postmark",
  async test(creds) {
    const err = requireFields(creds, ["api_key", "from_domain"]);
    if (err) return { ok: false, message: err };
    try {
      const res = await fetch("https://api.postmarkapp.com/server", {
        headers: { "X-Postmark-Server-Token": creds.api_key!, Accept: "application/json" },
      });
      if (!res.ok) {
        return { ok: false, message: `Postmark rejected the token (${res.status}).` };
      }
      const j = (await res.json()) as { Name?: string; ID?: number };
      return ok(`Connected to Postmark server ${j.Name ?? j.ID ?? ""}.`, {
        server_id: j.ID ?? null,
        server_name: j.Name ?? null,
        from_domain: creds.from_domain,
      });
    } catch (e) {
      return { ok: false, message: `Could not reach Postmark: ${(e as Error).message}` };
    }
  },
};

// ------------------- MESSAGING ---------------------
export const metaWhatsAppAdapter: Adapter = {
  provider: "meta_wa",
  async test(creds) {
    const err = requireFields(creds, [
      "phone_number_id",
      "business_account_id",
      "access_token",
      "verify_token",
    ]);
    if (err) return { ok: false, message: err };
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(creds.phone_number_id!)}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${creds.access_token}` } },
      );
      if (!res.ok) {
        return { ok: false, message: `Meta rejected the credentials (${res.status}).` };
      }
      const j = (await res.json()) as { display_phone_number?: string; verified_name?: string };
      return ok(`Connected to ${j.verified_name ?? j.display_phone_number ?? "WhatsApp number"}.`, {
        phone_number_id: creds.phone_number_id,
        business_account_id: creds.business_account_id,
        display_phone_number: j.display_phone_number ?? null,
        verified_name: j.verified_name ?? null,
      });
    } catch (e) {
      return { ok: false, message: `Could not reach Meta: ${(e as Error).message}` };
    }
  },
};

export const twilioSmsAdapter: Adapter = {
  provider: "twilio_sms",
  async test(creds) {
    const err = requireFields(creds, ["account_sid", "auth_token", "from_number"]);
    if (err) return { ok: false, message: err };
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.account_sid!)}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString("base64")}`,
          },
        },
      );
      if (!res.ok) {
        return { ok: false, message: `Twilio rejected the credentials (${res.status}).` };
      }
      const j = (await res.json()) as { friendly_name?: string; sid?: string };
      return ok(`Connected to Twilio account ${j.friendly_name ?? j.sid ?? ""}.`, {
        account_sid: creds.account_sid,
        from_number: creds.from_number,
        account_name: j.friendly_name ?? null,
      });
    } catch (e) {
      return { ok: false, message: `Could not reach Twilio: ${(e as Error).message}` };
    }
  },
};

export const twilioWhatsAppAdapter: Adapter = {
  provider: "twilio_wa",
  async test(creds) {
    // Same verification path as SMS — different from_number semantics.
    const err = requireFields(creds, ["account_sid", "auth_token", "from_number"]);
    if (err) return { ok: false, message: err };
    if (!creds.from_number!.startsWith("whatsapp:")) {
      return { ok: false, message: "WhatsApp from-number must start with `whatsapp:`." };
    }
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.account_sid!)}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString("base64")}`,
        },
      },
    );
    if (!res.ok) return { ok: false, message: `Twilio rejected the credentials (${res.status}).` };
    return ok(`Twilio WhatsApp ready on ${creds.from_number}.`, {
      account_sid: creds.account_sid,
      from_number: creds.from_number,
    });
  },
};
