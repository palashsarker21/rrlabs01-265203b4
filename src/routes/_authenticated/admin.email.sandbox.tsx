import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { listEmailTemplates } from "@/lib/email.functions";
import { getSandboxStatusFn, sendSandboxTestFn } from "@/lib/email-sandbox.functions";
import { TEMPLATE_SAMPLES } from "@/lib/email/template-samples";

export const Route = createFileRoute("/_authenticated/admin/email/sandbox")({
  head: () => ({
    meta: [{ title: "Email test sandbox — Admin — RRLabs" }],
  }),
  component: EmailSandboxPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Couldn't load the email sandbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      <button className="mt-3 rounded-md border px-3 py-1.5 text-sm" onClick={() => reset()}>
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

type SendOutcome = Awaited<ReturnType<typeof sendSandboxTestFn>>;

function EmailSandboxPage() {
  const listTpl = useServerFn(listEmailTemplates);
  const statusFn = useServerFn(getSandboxStatusFn);
  const sendFn = useServerFn(sendSandboxTestFn);

  const templatesQ = useQuery({
    queryKey: ["email", "templates"],
    queryFn: () => listTpl(),
  });
  const statusQ = useQuery({
    queryKey: ["email", "sandbox", "status"],
    queryFn: () => statusFn({ data: {} as never }),
    refetchInterval: 30_000,
  });

  const templates = templatesQ.data?.templates ?? [];
  const [selected, setSelected] = useState<string>("welcome");
  const [dataText, setDataText] = useState<string>(() =>
    JSON.stringify(TEMPLATE_SAMPLES["welcome"]?.data ?? {}, null, 2),
  );
  const [lastOutcome, setLastOutcome] = useState<SendOutcome | null>(null);

  useEffect(() => {
    const sample = TEMPLATE_SAMPLES[selected]?.data ?? {};
    setDataText(JSON.stringify(sample, null, 2));
    setLastOutcome(null);
  }, [selected]);

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(dataText || "{}");
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { ok: false as const, error: "Data must be a JSON object." };
      }
      return { ok: true as const, value: value as Record<string, unknown> };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  }, [dataText]);

  const status = statusQ.data;
  const usage = status?.usage;
  const limits = status?.limits;

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!parsed.ok) throw new Error(parsed.error);
      return sendFn({ data: { template: selected, data: parsed.value } });
    },
    onSuccess: (r) => {
      setLastOutcome(r);
      statusQ.refetch();
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Email test sandbox</h1>
        <p className="text-sm text-muted-foreground">
          Send any registered template to yourself with safe rate limits and full delivery diagnostics.
          Real recipients are locked to your signed-in email.
        </p>
      </header>

      {/* Status strip */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Recipient</div>
          <div className="mt-1 font-mono text-sm">{status?.recipient ?? "…"}</div>
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Provider config</div>
          {status?.config?.ok ? (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Ready
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {status.config.fromName} &lt;{status.config.fromEmail}&gt;
              </span>
            </div>
          ) : status ? (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Not configured
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                Missing: {status.config.missing?.join(", ") ?? "unknown"}
              </p>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">Checking…</div>
          )}
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Rate limit</div>
          {usage && limits ? (
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
              <UsageMeter label="minute" used={usage.minute} cap={limits.perMinute} />
              <UsageMeter label="hour" used={usage.hour} cap={limits.perHour} />
              <UsageMeter label="day" used={usage.day} cap={limits.perDay} />
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">…</div>
          )}
        </div>
      </section>

      {/* DNS diagnostics */}
      {status?.dns && status.dns.length > 0 ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">DNS checks</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {status.dns.map((d) => {
              const state = d.valid ? "ok" : d.found ? "warning" : "missing";
              const tone =
                state === "ok"
                  ? "text-emerald-700"
                  : state === "warning"
                    ? "text-amber-700"
                    : "text-rose-700";
              return (
              <li key={d.record} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{d.record}</span>
                  <span className={tone}>{state}</span>
                </div>
                {d.note ? <p className="mt-1 text-muted-foreground">{d.note}</p> : null}
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Composer */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Compose</h2>
            <a href="/admin/email/preview" className="text-xs font-medium text-primary hover:underline">
              Open template preview →
            </a>
          </div>

          <label className="block text-xs font-medium text-muted-foreground">Template</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.displayName ?? t.name}
              </option>
            ))}
          </select>

          <label className="block text-xs font-medium text-muted-foreground">Template data (JSON)</label>
          <textarea
            className="h-64 w-full rounded-md border px-3 py-2 font-mono text-xs"
            spellCheck={false}
            value={dataText}
            onChange={(e) => setDataText(e.target.value)}
          />
          {!parsed.ok ? (
            <p className="text-xs text-rose-700">JSON error: {parsed.error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sends to <span className="font-mono">{status?.recipient ?? "your account email"}</span>.
            </p>
          )}
          <button
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => sendMut.mutate()}
            disabled={
              !parsed.ok ||
              sendMut.isPending ||
              !status?.config?.ok ||
              !status?.recipient
            }
          >
            {sendMut.isPending ? "Sending…" : "Send test email"}
          </button>
        </div>

        {/* Diagnostics */}
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Last send diagnostics</h2>
          {sendMut.error ? (
            <p className="text-sm text-rose-700">{(sendMut.error as Error).message}</p>
          ) : null}
          {!lastOutcome ? (
            <p className="text-sm text-muted-foreground">
              Run a send to see timings, provider ids, and any errors here.
            </p>
          ) : lastOutcome.ok === false ? (
            <div className="space-y-2 text-sm">
              <Badge tone="rose">Blocked: {lastOutcome.error}</Badge>
              {"window" in lastOutcome && lastOutcome.window ? (
                <p className="text-xs text-muted-foreground">
                  Rate limit exceeded in the last {lastOutcome.window}. Wait and retry.
                </p>
              ) : null}
              {"message" in lastOutcome && lastOutcome.message ? (
                <p className="text-xs text-muted-foreground">{lastOutcome.message}</p>
              ) : null}
            </div>
          ) : (
            <SuccessDiagnostics outcome={lastOutcome} />
          )}
        </div>
      </section>
    </div>
  );
}

function UsageMeter({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(cap, 1)) * 100));
  const tone = pct >= 100 ? "bg-rose-500" : pct >= 66 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="tabular-nums">{used}/{cap}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "emerald" | "amber" | "rose"; children: React.ReactNode }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function SuccessDiagnostics({ outcome }: { outcome: Extract<SendOutcome, { ok: true }> }) {
  const r = outcome.result;
  const d = outcome.diagnostics;
  const skipped = r.ok && (r as { skipped?: boolean }).skipped;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        {r.ok && !skipped ? (
          <Badge tone="emerald">Sent</Badge>
        ) : skipped ? (
          <Badge tone="amber">Skipped</Badge>
        ) : (
          <Badge tone="rose">Failed</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {outcome.durationMs} ms · to <span className="font-mono">{outcome.recipient}</span>
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
        <Row k="Log ID" v={d.logId ?? (r.ok ? r.id : "—")} mono />
        <Row k="Message ID" v={d.messageId ?? "—"} mono />
        <Row k="Attempts" v={d.attempts?.toString() ?? "—"} />
        <Row k="Status" v={d.status ?? (r.ok ? "sent" : "failed")} />
        <Row k="Subject" v={d.subject ?? "—"} span={2} />
        {d.lastError ? <Row k="Error" v={d.lastError} span={3} /> : null}
        {!r.ok ? <Row k="Reason" v={`${r.code}: ${r.error}`} span={3} /> : null}
        {skipped && "reason" in r ? <Row k="Skip reason" v={String(r.reason)} span={3} /> : null}
      </dl>
    </div>
  );
}

function Row({ k, v, mono, span = 1 }: { k: string; v: string; mono?: boolean; span?: 1 | 2 | 3 }) {
  const colSpan = span === 3 ? "col-span-3" : span === 2 ? "col-span-2" : "col-span-1";
  return (
    <div className={colSpan}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className={mono ? "break-all font-mono" : "break-words"}>{v}</dd>
    </div>
  );
}
