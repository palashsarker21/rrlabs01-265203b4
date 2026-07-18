/**
 * Recipient domain deliverability check.
 *
 * Server-side DNS-over-HTTPS (Cloudflare 1.1.1.1, Google fallback) lookup of
 * MX, A/AAAA, SPF, and DMARC records for the recipient's domain. Combined with
 * static heuristics (syntax, disposable providers, common typos, role
 * mailboxes) it returns a deliverability report the sandbox displays before a
 * test send. This is a warning surface, not a blocklist — the caller decides
 * whether to proceed.
 *
 * Super-admin gated to match the rest of the sandbox surface.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOH_ENDPOINTS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
] as const;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "sharklasers.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "trashmail.com",
  "yopmail.com",
  "getnada.com",
  "throwawaymail.com",
  "maildrop.cc",
  "fakeinbox.com",
  "dispostable.com",
  "mintemail.com",
]);

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "iclould.com": "icloud.com",
  "icoud.com": "icloud.com",
  "protonmial.com": "protonmail.com",
};

const ROLE_LOCAL_PARTS = new Set([
  "admin",
  "administrator",
  "postmaster",
  "hostmaster",
  "webmaster",
  "info",
  "support",
  "sales",
  "billing",
  "noreply",
  "no-reply",
  "help",
  "abuse",
  "security",
  "contact",
]);

type DnsAnswer = { name: string; type: number; TTL: number; data: string };

type DohResponse = {
  Status: number;
  Answer?: DnsAnswer[];
  Authority?: DnsAnswer[];
};

async function dohQuery(name: string, type: string): Promise<DohResponse | null> {
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}?name=${encodeURIComponent(name)}&type=${type}`, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      return (await res.json()) as DohResponse;
    } catch {
      continue;
    }
  }
  return null;
}

function parseTxtAnswer(a: DnsAnswer): string {
  // TXT answers arrive as quoted concatenated strings.
  return a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export type RecipientCheckSeverity = "info" | "warning" | "critical";

export type RecipientCheck = {
  id: string;
  label: string;
  severity: RecipientCheckSeverity | "ok";
  detail?: string;
};

export type RecipientCheckReport = {
  recipient: string;
  domain: string | null;
  overall: "ok" | "warning" | "critical";
  checks: RecipientCheck[];
  suggestion?: string;
  mx: { host: string; priority: number }[];
  spf: string | null;
  dmarc: string | null;
  hasA: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function worst(
  a: RecipientCheckReport["overall"],
  b: RecipientCheckSeverity | "ok",
): RecipientCheckReport["overall"] {
  const rank = { ok: 0, info: 0, warning: 1, critical: 2 } as const;
  const cur = rank[a];
  const next = rank[b];
  return next > cur ? (b === "critical" ? "critical" : "warning") : a;
}

export const checkRecipientDeliverability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient: string }) =>
    z.object({ recipient: z.string().trim().min(3).max(320) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RecipientCheckReport> => {
    await assertSuperAdmin(context);

    const recipient = data.recipient.trim().toLowerCase();
    const checks: RecipientCheck[] = [];
    let overall: RecipientCheckReport["overall"] = "ok";
    let suggestion: string | undefined;

    if (!EMAIL_RE.test(recipient)) {
      checks.push({
        id: "syntax",
        label: "Email syntax",
        severity: "critical",
        detail: "Address is not a valid RFC-shaped email.",
      });
      return {
        recipient,
        domain: null,
        overall: "critical",
        checks,
        mx: [],
        spf: null,
        dmarc: null,
        hasA: false,
      };
    }
    checks.push({ id: "syntax", label: "Email syntax", severity: "ok" });

    const [localPart, domain] = recipient.split("@") as [string, string];

    if (ROLE_LOCAL_PARTS.has(localPart)) {
      checks.push({
        id: "role",
        label: "Role mailbox",
        severity: "warning",
        detail: `${localPart}@ is a role address — many providers auto-suppress or filter these.`,
      });
      overall = worst(overall, "warning");
    }

    if (COMMON_DOMAIN_TYPOS[domain]) {
      suggestion = `${localPart}@${COMMON_DOMAIN_TYPOS[domain]}`;
      checks.push({
        id: "typo",
        label: "Likely typo in domain",
        severity: "warning",
        detail: `"${domain}" looks like a typo. Did you mean "${COMMON_DOMAIN_TYPOS[domain]}"?`,
      });
      overall = worst(overall, "warning");
    }

    if (DISPOSABLE_DOMAINS.has(domain)) {
      checks.push({
        id: "disposable",
        label: "Disposable provider",
        severity: "warning",
        detail: `${domain} is a disposable/temporary inbox provider. Delivery may succeed but the recipient likely won't see it.`,
      });
      overall = worst(overall, "warning");
    }

    // DNS lookups
    const [mxRes, aRes, aaaaRes, spfRes, dmarcRes] = await Promise.all([
      dohQuery(domain, "MX"),
      dohQuery(domain, "A"),
      dohQuery(domain, "AAAA"),
      dohQuery(domain, "TXT"),
      dohQuery(`_dmarc.${domain}`, "TXT"),
    ]);

    if (!mxRes) {
      checks.push({
        id: "dns",
        label: "DNS resolvers",
        severity: "critical",
        detail: "DNS-over-HTTPS resolvers were unreachable. Try again in a moment.",
      });
      overall = worst(overall, "critical");
      return {
        recipient,
        domain,
        overall,
        checks,
        suggestion,
        mx: [],
        spf: null,
        dmarc: null,
        hasA: false,
      };
    }

    // NXDOMAIN
    if (mxRes.Status === 3) {
      checks.push({
        id: "domain",
        label: "Domain exists",
        severity: "critical",
        detail: `"${domain}" does not resolve (NXDOMAIN). Emails will bounce.`,
      });
      overall = worst(overall, "critical");
      return {
        recipient,
        domain,
        overall,
        checks,
        suggestion,
        mx: [],
        spf: null,
        dmarc: null,
        hasA: false,
      };
    }

    const mxAnswers = (mxRes.Answer ?? []).filter((a) => a.type === 15);
    const mx = mxAnswers
      .map((a) => {
        const [prio, host] = a.data.split(/\s+/, 2);
        return { priority: Number(prio ?? 0), host: (host ?? "").replace(/\.$/, "") };
      })
      .filter((r) => r.host.length > 0)
      .sort((a, b) => a.priority - b.priority);

    const hasA =
      (aRes?.Answer ?? []).some((a) => a.type === 1) ||
      (aaaaRes?.Answer ?? []).some((a) => a.type === 28);

    if (mx.length === 0) {
      // RFC 5321 §5.1: with no MX, A/AAAA is an implicit mail exchanger.
      if (hasA) {
        checks.push({
          id: "mx",
          label: "MX records",
          severity: "warning",
          detail:
            "No MX records — mail will fall back to the domain's A/AAAA record (implicit MX). Delivery is possible but weak.",
        });
        overall = worst(overall, "warning");
      } else {
        checks.push({
          id: "mx",
          label: "MX records",
          severity: "critical",
          detail: "No MX and no A/AAAA record. This domain cannot receive mail.",
        });
        overall = worst(overall, "critical");
      }
    } else {
      checks.push({
        id: "mx",
        label: `MX records (${mx.length})`,
        severity: "ok",
        detail: mx
          .slice(0, 3)
          .map((m) => `${m.priority} ${m.host}`)
          .join(", "),
      });
    }

    const spfTxt = (spfRes?.Answer ?? [])
      .filter((a) => a.type === 16)
      .map(parseTxtAnswer)
      .find((v) => v.toLowerCase().startsWith("v=spf1"));
    if (spfTxt) {
      checks.push({
        id: "spf",
        label: "SPF record",
        severity: "ok",
        detail: spfTxt.length > 120 ? `${spfTxt.slice(0, 117)}…` : spfTxt,
      });
    } else {
      checks.push({
        id: "spf",
        label: "SPF record",
        severity: "info",
        detail:
          "No SPF record on the recipient domain — informational only; recipient SPF does not affect inbound delivery from us.",
      });
    }

    const dmarcTxt = (dmarcRes?.Answer ?? [])
      .filter((a) => a.type === 16)
      .map(parseTxtAnswer)
      .find((v) => v.toLowerCase().startsWith("v=dmarc1"));
    if (dmarcTxt) {
      checks.push({
        id: "dmarc",
        label: "DMARC policy",
        severity: "ok",
        detail: dmarcTxt.length > 120 ? `${dmarcTxt.slice(0, 117)}…` : dmarcTxt,
      });
    } else {
      checks.push({
        id: "dmarc",
        label: "DMARC policy",
        severity: "info",
        detail: "No DMARC record — informational; does not block inbound.",
      });
    }

    return {
      recipient,
      domain,
      overall,
      checks,
      suggestion,
      mx,
      spf: spfTxt ?? null,
      dmarc: dmarcTxt ?? null,
      hasA,
    };
  });
