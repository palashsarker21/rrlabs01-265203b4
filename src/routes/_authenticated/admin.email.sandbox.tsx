import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { listEmailTemplates } from "@/lib/email.functions";
import { getSandboxStatusFn, sendSandboxTestFn } from "@/lib/email-sandbox.functions";
import {
  checkRecipientDeliverability,
  type RecipientCheckReport,
} from "@/lib/recipient-dns.functions";
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

type HistoryEntry = {
  id: string;
  sentAt: string;
  template: string;
  templateDisplayName?: string;
  dataText: string;
  recipient: string;
  status: "sent" | "skipped" | "failed" | "blocked";
  durationMs?: number;
  messageId?: string;
  logId?: string;
  subject?: string;
  errorMessage?: string;
  outcome: SendOutcome;
};

const HISTORY_KEY = "rrlabs.sandbox.history.v1";
const HISTORY_MAX = 50;

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {
    // ignore quota / unavailable storage
  }
}

function triggerDownload(filename: string, mime: string, contents: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportDiagnostics(entries: HistoryEntry[], format: "json" | "csv") {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  if (format === "json") {
    const payload = {
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    };
    triggerDownload(
      `sandbox-diagnostics-${ts}.json`,
      "application/json",
      JSON.stringify(payload, null, 2),
    );
    return;
  }
  const headers = [
    "id",
    "sentAt",
    "template",
    "templateDisplayName",
    "recipient",
    "status",
    "durationMs",
    "messageId",
    "logId",
    "subject",
    "errorMessage",
    "dataText",
    "outcome",
  ];
  const rows = entries.map((e) =>
    [
      e.id,
      e.sentAt,
      e.template,
      e.templateDisplayName ?? "",
      e.recipient,
      e.status,
      e.durationMs ?? "",
      e.messageId ?? "",
      e.logId ?? "",
      e.subject ?? "",
      e.errorMessage ?? "",
      e.dataText,
      e.outcome,
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\r\n");
  triggerDownload(`sandbox-diagnostics-${ts}.csv`, "text/csv", csv);
}

function summarizeOutcome(outcome: SendOutcome): {
  status: HistoryEntry["status"];
  durationMs?: number;
  messageId?: string;
  logId?: string;
  subject?: string;
  errorMessage?: string;
} {
  if (outcome.ok === false) {
    return {
      status: "blocked",
      errorMessage: outcome.error,
    };
  }
  const r = outcome.result;
  const d = outcome.diagnostics;
  const skipped = r.ok && (r as { skipped?: boolean }).skipped;
  const status: HistoryEntry["status"] = !r.ok ? "failed" : skipped ? "skipped" : "sent";
  return {
    status,
    durationMs: outcome.durationMs,
    messageId: d.messageId ?? undefined,
    logId: d.logId ?? (r.ok ? r.id : undefined),
    subject: d.subject ?? undefined,
    errorMessage: !r.ok ? `${r.code}: ${r.error}` : (d.lastError ?? undefined),
  };
}

function EmailSandboxPage() {
  const listTpl = useServerFn(listEmailTemplates);
  const statusFn = useServerFn(getSandboxStatusFn);
  const sendFn = useServerFn(sendSandboxTestFn);
  const checkRecipientFn = useServerFn(checkRecipientDeliverability);

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
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [historySearch, setHistorySearch] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [autoRunId, setAutoRunId] = useState<string | null>(null);
  const [recipientCheck, setRecipientCheck] = useState<RecipientCheckReport | null>(null);
  const [recipientCheckError, setRecipientCheckError] = useState<string | null>(null);
  const [recipientChecking, setRecipientChecking] = useState(false);
  const [ackWarnings, setAckWarnings] = useState(false);

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
  const recipient = status?.recipient ?? null;

  // Auto-run a recipient DNS check whenever the locked recipient changes.
  useEffect(() => {
    if (!recipient) return;
    let cancelled = false;
    setRecipientChecking(true);
    setRecipientCheckError(null);
    setAckWarnings(false);
    checkRecipientFn({ data: { recipient } })
      .then((r) => {
        if (!cancelled) setRecipientCheck(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRecipientCheck(null);
          setRecipientCheckError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setRecipientChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipient, checkRecipientFn]);

  async function recheckRecipient() {
    if (!recipient) return;
    setRecipientChecking(true);
    setRecipientCheckError(null);
    try {
      const r = await checkRecipientFn({ data: { recipient } });
      setRecipientCheck(r);
      setAckWarnings(false);
    } catch (err) {
      setRecipientCheck(null);
      setRecipientCheckError(err instanceof Error ? err.message : String(err));
    } finally {
      setRecipientChecking(false);
    }
  }

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!parsed.ok) throw new Error(parsed.error);
      return sendFn({ data: { template: selected, data: parsed.value } });
    },
    onSuccess: (r) => {
      setLastOutcome(r);
      statusQ.refetch();

      const summary = summarizeOutcome(r);
      const templateEntry = templates.find((t) => t.name === selected);
      const entry: HistoryEntry = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        sentAt: new Date().toISOString(),
        template: selected,
        templateDisplayName: templateEntry?.displayName,
        dataText,
        recipient: status?.recipient ?? "",
        outcome: r,
        ...summary,
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, HISTORY_MAX);
        saveHistory(next);
        return next;
      });
      setExpandedHistoryId(entry.id);
    },
  });

  // Auto-run a queued "re-run from history" after state settles.
  useEffect(() => {
    if (!autoRunId) return;
    if (!parsed.ok || sendMut.isPending) return;
    if (!status?.config?.ok || !status?.recipient) return;
    if (recipientChecking) return;
    if (recipientCheck?.overall === "critical") return;
    if (recipientCheck?.overall === "warning" && !ackWarnings) return;
    const id = autoRunId;
    setAutoRunId(null);
    sendMut.mutate(undefined, {
      onSettled: () => setExpandedHistoryId((cur) => cur ?? id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunId, parsed.ok, dataText, selected, status?.config?.ok, status?.recipient]);

  function rerunEntry(entry: HistoryEntry) {
    setSelected(entry.template);
    setDataText(entry.dataText);
    setLastOutcome(null);
    setAutoRunId(entry.id);
  }

  function removeHistoryEntry(id: string) {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveHistory(next);
      return next;
    });
    setExpandedHistoryId((cur) => (cur === id ? null : cur));
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
    setExpandedHistoryId(null);
  }

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter((e) => {
      const hay = [
        e.template,
        e.templateDisplayName ?? "",
        e.recipient,
        e.subject ?? "",
        e.messageId ?? "",
        e.logId ?? "",
        e.errorMessage ?? "",
        e.status,
        e.dataText,
      ]
        .join(" \u0001 ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [history, historySearch]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Email test sandbox</h1>
        <p className="text-sm text-muted-foreground">
          Send any registered template to yourself with safe rate limits and full delivery
          diagnostics. Real recipients are locked to your signed-in email.
        </p>
      </header>

      {/* Status strip */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Recipient</div>
          <div className="mt-1 font-mono text-sm">{status?.recipient ?? "…"}</div>
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Provider config
          </div>
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
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Rate limit</div>
            {usage && limits ? (
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {Math.max(0, limits.perMinute - usage.minute)}/min ·{" "}
                {Math.max(0, limits.perHour - usage.hour)}/hr ·{" "}
                {Math.max(0, limits.perDay - usage.day)}/day left
              </div>
            ) : null}
          </div>
          {usage && limits ? (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <UsageMeter label="per minute" used={usage.minute} cap={limits.perMinute} />
                <UsageMeter label="per hour" used={usage.hour} cap={limits.perHour} />
                <UsageMeter label="per day" used={usage.day} cap={limits.perDay} />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Sends are counted per admin (that's you). When any window hits its cap, further test
                sends are throttled server-side until that window rolls over — the composer blocks
                and shows which limit was hit before any email is queued.
              </p>
            </>
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

      {/* Recipient deliverability */}
      <section className="rounded-lg border p-4 space-y-3" aria-labelledby="recip-check-h">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="recip-check-h" className="font-semibold">
              Recipient deliverability
            </h2>
            <p className="text-xs text-muted-foreground">
              MX, A/AAAA, SPF and DMARC lookup for{" "}
              <span className="font-mono">{recipient ?? "your locked recipient"}</span>. Runs
              server-side over DNS-over-HTTPS before each send.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            onClick={recheckRecipient}
            disabled={!recipient || recipientChecking}
          >
            {recipientChecking ? "Checking…" : "Re-check"}
          </button>
        </div>

        {recipientCheckError ? (
          <p className="text-sm text-rose-700">{recipientCheckError}</p>
        ) : recipientChecking && !recipientCheck ? (
          <p className="text-sm text-muted-foreground">Resolving DNS records…</p>
        ) : recipientCheck ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge
                tone={
                  recipientCheck.overall === "critical"
                    ? "rose"
                    : recipientCheck.overall === "warning"
                      ? "amber"
                      : "emerald"
                }
              >
                {recipientCheck.overall === "ok"
                  ? "Looks deliverable"
                  : recipientCheck.overall === "warning"
                    ? "Warnings"
                    : "Likely undeliverable"}
              </Badge>
              {recipientCheck.domain ? (
                <span className="text-xs text-muted-foreground">
                  domain <span className="font-mono">{recipientCheck.domain}</span>
                </span>
              ) : null}
              {recipientCheck.suggestion ? (
                <span className="text-xs text-amber-700">
                  Did you mean <span className="font-mono">{recipientCheck.suggestion}</span>?
                </span>
              ) : null}
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recipientCheck.checks.map((c) => {
                const tone =
                  c.severity === "ok"
                    ? "text-emerald-700"
                    : c.severity === "info"
                      ? "text-muted-foreground"
                      : c.severity === "warning"
                        ? "text-amber-700"
                        : "text-rose-700";
                return (
                  <li key={c.id} className="rounded border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.label}</span>
                      <span className={tone}>{c.severity}</span>
                    </div>
                    {c.detail ? (
                      <p className="mt-1 break-words text-muted-foreground">{c.detail}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {recipientCheck.overall !== "ok" ? (
              <label className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ackWarnings}
                  onChange={(e) => setAckWarnings(e.target.checked)}
                />
                <span>I understand the deliverability warnings above and want to send anyway.</span>
              </label>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Recipient will be checked automatically when it loads.
          </p>
        )}
      </section>

      {/* Composer */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Compose</h2>
            <a
              href="/admin/email/preview"
              className="text-xs font-medium text-primary hover:underline"
            >
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

          <label className="block text-xs font-medium text-muted-foreground">
            Template data (JSON)
          </label>
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
              Sends to{" "}
              <span className="font-mono">{status?.recipient ?? "your account email"}</span>.
            </p>
          )}
          {(() => {
            if (!usage || !limits) return null;
            const windows = [
              { key: "minute", label: "this minute", used: usage.minute, cap: limits.perMinute },
              { key: "hour", label: "this hour", used: usage.hour, cap: limits.perHour },
              { key: "day", label: "today", used: usage.day, cap: limits.perDay },
            ] as const;
            const tightest = windows
              .map((w) => ({ ...w, left: Math.max(0, w.cap - w.used) }))
              .sort((a, b) => a.left - b.left)[0];
            const blocked = tightest.left <= 0;
            const near = !blocked && tightest.left <= 1;
            const tone = blocked
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : near
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800";
            return (
              <div className={`rounded-md border px-3 py-2 text-xs ${tone}`}>
                {blocked ? (
                  <>
                    <strong>Throttled ({tightest.label}).</strong> You've used {tightest.used}/
                    {tightest.cap} sends for {tightest.label}. Clicking Send will be rejected
                    server-side until the {tightest.key} window rolls over.
                  </>
                ) : (
                  <>
                    <strong>Before you send:</strong> this will consume 1 of your remaining{" "}
                    {tightest.left} sends {tightest.label} (also{" "}
                    {Math.max(0, limits.perMinute - usage.minute)}/min,{" "}
                    {Math.max(0, limits.perHour - usage.hour)}/hr,{" "}
                    {Math.max(0, limits.perDay - usage.day)}/day). Hitting any cap throttles further
                    test sends.
                  </>
                )}
              </div>
            );
          })()}
          <button
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => sendMut.mutate()}
            disabled={
              !parsed.ok ||
              sendMut.isPending ||
              !status?.config?.ok ||
              !status?.recipient ||
              recipientChecking ||
              recipientCheck?.overall === "critical" ||
              (recipientCheck?.overall === "warning" && !ackWarnings) ||
              (!!usage &&
                !!limits &&
                (usage.minute >= limits.perMinute ||
                  usage.hour >= limits.perHour ||
                  usage.day >= limits.perDay))
            }
          >
            {sendMut.isPending ? "Sending…" : "Send test email"}
          </button>
          {recipientCheck?.overall === "critical" ? (
            <p className="text-xs text-rose-700">
              Sending is blocked because the recipient domain cannot receive mail.
            </p>
          ) : recipientCheck?.overall === "warning" && !ackWarnings ? (
            <p className="text-xs text-amber-700">
              Acknowledge the deliverability warnings above to enable sending.
            </p>
          ) : null}
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

      {/* Test-send history */}
      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Test-send history</h2>
            <p className="text-xs text-muted-foreground">
              Locally recorded on this device. Re-run replays the exact template and JSON payload.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 ? (
              <>
                <button
                  type="button"
                  className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  onClick={() => exportDiagnostics(filteredHistory, "json")}
                  disabled={filteredHistory.length === 0}
                  title="Download the filtered history as JSON"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  onClick={() => exportDiagnostics(filteredHistory, "csv")}
                  disabled={filteredHistory.length === 0}
                  title="Download the filtered history as CSV"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground hover:text-rose-700"
                  onClick={clearHistory}
                >
                  Clear history
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="w-full rounded-md border px-3 py-2 text-sm sm:w-80"
            placeholder="Search by template, subject, recipient, message id…"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            aria-label="Search test-send history"
          />
          <span className="text-xs text-muted-foreground">
            {filteredHistory.length} of {history.length} entr{history.length === 1 ? "y" : "ies"}
          </span>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sends yet. Run a test above and it will appear here.
          </p>
        ) : filteredHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries match that search.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {filteredHistory.map((entry) => {
              const tone: "emerald" | "amber" | "rose" =
                entry.status === "sent" ? "emerald" : entry.status === "skipped" ? "amber" : "rose";
              const isOpen = expandedHistoryId === entry.id;
              return (
                <li key={entry.id} className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={tone}>{entry.status}</Badge>
                        <span className="font-medium">
                          {entry.templateDisplayName ?? entry.template}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {entry.template}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <time dateTime={entry.sentAt}>
                          {new Date(entry.sentAt).toLocaleString()}
                        </time>
                        {" · to "}
                        <span className="font-mono">{entry.recipient || "—"}</span>
                        {typeof entry.durationMs === "number" ? (
                          <span> · {entry.durationMs} ms</span>
                        ) : null}
                      </div>
                      {entry.subject ? (
                        <div className="mt-1 truncate text-xs">
                          <span className="text-muted-foreground">Subject: </span>
                          {entry.subject}
                        </div>
                      ) : null}
                      {entry.errorMessage ? (
                        <div className="mt-1 truncate text-xs text-rose-700">
                          {entry.errorMessage}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        onClick={() => setExpandedHistoryId(isOpen ? null : entry.id)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide" : "Details"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() => rerunEntry(entry)}
                        disabled={sendMut.isPending || !status?.config?.ok || !status?.recipient}
                        title={
                          !status?.config?.ok
                            ? "Provider not configured"
                            : !status?.recipient
                              ? "Recipient unavailable"
                              : "Load these inputs and send again"
                        }
                      >
                        {autoRunId === entry.id ? "Re-running…" : "Re-run"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-rose-700"
                        onClick={() => removeHistoryEntry(entry.id)}
                        aria-label="Remove entry"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="mt-3 space-y-3 rounded-md bg-muted/40 p-3">
                      {entry.outcome.ok === false ? (
                        <div className="space-y-1 text-sm">
                          <Badge tone="rose">Blocked: {entry.outcome.error}</Badge>
                          {"window" in entry.outcome && entry.outcome.window ? (
                            <p className="text-xs text-muted-foreground">
                              Rate limit exceeded in the last {entry.outcome.window}.
                            </p>
                          ) : null}
                          {"message" in entry.outcome && entry.outcome.message ? (
                            <p className="text-xs text-muted-foreground">{entry.outcome.message}</p>
                          ) : null}
                        </div>
                      ) : (
                        <SuccessDiagnostics outcome={entry.outcome} />
                      )}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          Payload JSON
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 font-mono text-[11px]">
                          {entry.dataText}
                        </pre>
                      </details>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
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
        <span className="tabular-nums">
          {used}/{cap}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "rose";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
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
