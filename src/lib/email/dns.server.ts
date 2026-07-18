/**
 * DNS verification for SPF, DKIM, and DMARC.
 * Uses Google's public DNS-over-HTTPS resolver so it runs in Cloudflare Workers
 * without native `dns` bindings.
 */

export type DnsCheck = {
  record: "SPF" | "DKIM" | "DMARC";
  host: string;
  found: boolean;
  value: string | null;
  valid: boolean;
  note?: string;
};

async function dohTxt(host: string): Promise<string[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as { Answer?: { data: string }[] };
  return (body.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, ""));
}

function findRecord(records: string[], predicate: (r: string) => boolean): string | null {
  return records.find(predicate) ?? null;
}

export async function verifyEmailDns(domain: string, dkimSelector = "resend"): Promise<DnsCheck[]> {
  const [spfRecords, dkimRecords, dmarcRecords] = await Promise.all([
    dohTxt(domain).catch(() => []),
    dohTxt(`${dkimSelector}._domainkey.${domain}`).catch(() => []),
    dohTxt(`_dmarc.${domain}`).catch(() => []),
  ]);

  const spf = findRecord(spfRecords, (r) => r.startsWith("v=spf1"));
  const dkim = findRecord(dkimRecords, (r) => r.includes("v=DKIM1") || r.includes("p="));
  const dmarc = findRecord(dmarcRecords, (r) => r.startsWith("v=DMARC1"));

  return [
    {
      record: "SPF",
      host: domain,
      found: Boolean(spf),
      value: spf,
      valid: Boolean(spf && spf.includes("include:") && (spf.includes("~all") || spf.includes("-all"))),
      note: spf ? undefined : "No v=spf1 TXT record found on the sending domain.",
    },
    {
      record: "DKIM",
      host: `${dkimSelector}._domainkey.${domain}`,
      found: Boolean(dkim),
      value: dkim,
      valid: Boolean(dkim && dkim.includes("p=")),
      note: dkim ? undefined : `No DKIM record at ${dkimSelector}._domainkey.${domain} — publish the key Resend provides.`,
    },
    {
      record: "DMARC",
      host: `_dmarc.${domain}`,
      found: Boolean(dmarc),
      value: dmarc,
      valid: Boolean(dmarc && /p=(none|quarantine|reject)/.test(dmarc)),
      note: dmarc ? undefined : "No _dmarc TXT record found — publish at least v=DMARC1; p=none;",
    },
  ];
}
