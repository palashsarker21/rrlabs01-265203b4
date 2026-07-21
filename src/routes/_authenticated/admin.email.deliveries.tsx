import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listDeliveriesFn,
  getDeliveryFn,
  replayDeliveryFn,
  resolveBulkReplayFn,
  listTemplateOptionsFn,
} from "@/lib/email-delivery.functions";

type StatusFilter = "all" | "queued" | "sent" | "failed" | "skipped" | "retried";

export const Route = createFileRoute("/_authenticated/admin/email/deliveries")({
  head: () => ({
    meta: [{ title: "Email deliveries — Admin — RRLabs" }],
  }),
  component: EmailDeliveriesPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Couldn't load deliveries</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      <button className="mt-3 rounded-md border px-3 py-1.5 text-sm" onClick={() => reset()}>
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function statusBadge(s: string, attempts: number) {
  const cls: Record<string, string> = {
    sent: "bg-emerald-100 text-emerald-800",
    queued: "bg-sky-100 text-sky-800",
    failed: "bg-red-100 text-red-800",
    skipped: "bg-slate-100 text-slate-700",
  };
  const label = s === "sent" && attempts >= 2 ? `sent · retried ${attempts - 1}×` : s;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls[s] ?? "bg-slate-100 text-slate-700"}`}
    >
      {label}
    </span>
  );
}

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function EmailDeliveriesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDeliveriesFn);
  const getFn = useServerFn(getDeliveryFn);
  const replayFn = useServerFn(replayDeliveryFn);
  const resolveBulkFn = useServerFn(resolveBulkReplayFn);
  const tplFn = useServerFn(listTemplateOptionsFn);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [template, setTemplate] = useState("");
  const [recipient, setRecipient] = useState("");
  const [messageId, setMessageId] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replayMsg, setReplayMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pastedIds, setPastedIds] = useState("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  type BulkItem = {
    input: string;
    logId: string | null;
    recipient: string | null;
    template: string | null;
    status: "pending" | "running" | "ok" | "error";
    newLogId?: string;
    durationMs?: number;
    error?: string;
  };
  const [bulkRun, setBulkRun] = useState<{
    running: boolean;
    startedAt: number | null;
    finishedAt: number | null;
    items: BulkItem[];
    cancelRequested: boolean;
  } | null>(null);

  const [exporting, setExporting] = useState(false);
  const [live, setLive] = useState<"connecting" | "on" | "off">("connecting");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const limit = 50;

  const filters = useMemo(
    () => ({ status, template, recipient, messageId, limit, offset: page * limit }),
    [status, template, recipient, messageId, page],
  );

  const listQ = useQuery({
    queryKey: ["admin", "email", "deliveries", filters],
    queryFn: () => listFn({ data: filters }),
    refetchInterval: autoRefresh ? (live === "on" ? 30_000 : 10_000) : false,
    refetchOnWindowFocus: autoRefresh,
  });

  useEffect(() => {
    if (!autoRefresh) {
      setLive("off");
      return;
    }
    setLive("connecting");
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin", "email", "deliveries"] });
      }, 400);
    };
    const channel = supabase
      .channel("admin-email-deliveries")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_logs" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_events" },
        scheduleRefresh,
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setLive("on");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setLive("off");
      });
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [autoRefresh, qc]);

  const tplQ = useQuery({
    queryKey: ["admin", "email", "deliveries", "templates"],
    queryFn: () => tplFn(),
  });

  const detailQ = useQuery({
    queryKey: ["admin", "email", "delivery", selectedId],
    queryFn: () => getFn({ data: { id: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  const replay = useMutation({
    mutationFn: (id: string) => replayFn({ data: { id } }),
    onSuccess: (res, id) => {
      setReplayMsg(
        res.result.ok
          ? `Replayed → new log ${res.result.id} (${res.durationMs}ms)`
          : `Replay failed: ${res.result.error}`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "email", "deliveries"] });
      qc.invalidateQueries({ queryKey: ["admin", "email", "delivery", id] });
    },
    onError: (err) => setReplayMsg((err as Error).message),
  });

  async function runBulkReplay(payload: { ids: string[]; messageIds: string[] }) {
    let resolved;
    try {
      resolved = await resolveBulkFn({ data: payload });
    } catch (err) {
      setReplayMsg((err as Error).message);
      return;
    }
    const initial: BulkItem[] = resolved.items.map((r) => ({
      input: r.input,
      logId: r.logId,
      recipient: r.recipient,
      template: r.template,
      status: r.error ? "error" : "pending",
      error: r.error,
    }));
    setBulkRun({
      running: true,
      startedAt: Date.now(),
      finishedAt: null,
      items: initial,
      cancelRequested: false,
    });
    setBulkConfirmOpen(false);
    setSelectedIds(new Set());
    setPastedIds("");

    // Process sequentially so rate limits and per-item progress are honored.
    for (let i = 0; i < initial.length; i++) {
      const item = initial[i];
      // Read the latest state via a functional update to see cancelRequested.
      let cancelled = false;
      setBulkRun((s) => {
        if (!s) return s;
        cancelled = s.cancelRequested;
        return s;
      });
      if (cancelled) break;
      if (!item.logId) continue; // pre-marked error

      setBulkRun((s) =>
        s
          ? {
              ...s,
              items: s.items.map((it, idx) => (idx === i ? { ...it, status: "running" } : it)),
            }
          : s,
      );

      try {
        const res = await replayFn({ data: { id: item.logId } });
        setBulkRun((s) =>
          s
            ? {
                ...s,
                items: s.items.map((it, idx) =>
                  idx === i
                    ? {
                        ...it,
                        status: res.result.ok ? "ok" : "error",
                        newLogId: res.result.ok ? res.result.id : undefined,
                        durationMs: res.durationMs,
                        error: res.result.ok ? undefined : res.result.error,
                      }
                    : it,
                ),
              }
            : s,
        );
      } catch (err) {
        setBulkRun((s) =>
          s
            ? {
                ...s,
                items: s.items.map((it, idx) =>
                  idx === i
                    ? {
                        ...it,
                        status: "error",
                        error: err instanceof Error ? err.message : String(err),
                      }
                    : it,
                ),
              }
            : s,
        );
      }
    }

    setBulkRun((s) => (s ? { ...s, running: false, finishedAt: Date.now() } : s));
    qc.invalidateQueries({ queryKey: ["admin", "email", "deliveries"] });
  }

  const rows = listQ.data?.rows ?? [];
  const counts = listQ.data?.counts;

  const pastedTokens = useMemo(
    () =>
      pastedIds
        .split(/[\s,;]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    [pastedIds],
  );
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pastedLogIds = pastedTokens.filter((t) => UUID_RE.test(t));
  const pastedMessageIds = pastedTokens.filter((t) => !UUID_RE.test(t));
  const bulkIds = useMemo(
    () => Array.from(new Set<string>([...selectedIds, ...pastedLogIds])),
    [selectedIds, pastedLogIds],
  );
  const bulkTotal = bulkIds.length + pastedMessageIds.length;
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  function csvEscape(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const res = await listFn({
        data: { status, template, recipient, messageId, limit: 1000, offset: 0 },
      });
      const cols = [
        "id",
        "created_at",
        "status",
        "attempts",
        "template",
        "recipient",
        "subject",
        "provider",
        "provider_message_id",
        "sent_at",
        "failed_at",
        "last_error",
      ] as const;
      const header = cols.join(",");
      const lines = (res.rows ?? []).map((r: Record<string, unknown>) =>
        cols.map((c) => csvEscape(r[c])).join(","),
      );
      const csv = [header, ...lines].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `deliveries-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setReplayMsg(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of rows) next.delete(r.id);
      } else {
        for (const r of rows) next.add(r.id);
      }
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Email deliveries</h1>
          <p className="text-sm text-muted-foreground">
            Queued, retried, and failed delivery attempts across all workspaces. Replay a send by
            log ID or provider message ID.
          </p>
        </div>
        <a href="/admin/email" className="text-sm underline text-muted-foreground">
          ← Back to Email
        </a>
      </header>

      {/* Counters */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {(["total", "queued", "sent", "retried", "failed", "skipped"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setStatus(k === "total" ? "all" : (k as StatusFilter));
              setPage(0);
            }}
            className={`rounded-lg border p-3 text-left transition ${
              (k === "total" ? status === "all" : status === k)
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className="text-xl font-semibold">
              {counts ? counts[k as keyof typeof counts] : "—"}
            </div>
          </button>
        ))}
      </section>

      {/* Filters */}
      <section className="rounded-lg border p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setPage(0);
              }}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="retried">Retried (attempts ≥ 2)</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Template</span>
            <select
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setPage(0);
              }}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">All templates</option>
              {(tplQ.data?.templates ?? []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Recipient</span>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onBlur={() => setPage(0)}
              placeholder="name@example.com"
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Provider message ID</span>
            <input
              value={messageId}
              onChange={(e) => setMessageId(e.target.value)}
              onBlur={() => setPage(0)}
              placeholder="e.g. 4ef9a…"
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                !autoRefresh
                  ? "bg-slate-400"
                  : live === "on"
                    ? "bg-emerald-500 animate-pulse"
                    : live === "connecting"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-red-500"
              }`}
              aria-hidden
            />
            <span aria-live="polite">
              {!autoRefresh
                ? "Auto-refresh paused"
                : live === "on"
                  ? "Live"
                  : live === "connecting"
                    ? "Connecting…"
                    : "Polling"}
            </span>
            <span className="text-muted-foreground/70">·</span>
            <span>{listQ.isFetching ? "Refreshing…" : `${listQ.data?.total ?? 0} match`}</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className="underline"
              title={autoRefresh ? "Pause live updates" : "Resume live updates"}
            >
              {autoRefresh ? "Pause live" : "Resume live"}
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exporting || (listQ.data?.total ?? 0) === 0}
              className="underline disabled:opacity-50"
              title="Download filtered deliveries as CSV (up to 1000 rows)"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              onClick={() => {
                setStatus("all");
                setTemplate("");
                setRecipient("");
                setMessageId("");
                setPage(0);
              }}
              className="underline"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {replayMsg ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {replayMsg}
          <button className="ml-3 underline" onClick={() => setReplayMsg(null)}>
            dismiss
          </button>
        </div>
      ) : null}

      {/* Bulk replay */}
      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Bulk replay</h2>
            <p className="text-xs text-muted-foreground">
              Reissue delivery attempts for many messages at once. Tick rows below or paste log IDs
              / provider message IDs (whitespace, comma, or newline separated). Capped at 50 per
              request.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {bulkTotal} selected
              {selectedIds.size > 0 || pastedIds.trim() ? (
                <>
                  {" · "}
                  <button
                    className="underline"
                    onClick={() => {
                      setSelectedIds(new Set());
                      setPastedIds("");
                    }}
                  >
                    clear
                  </button>
                </>
              ) : null}
            </span>
            <button
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              disabled={bulkTotal === 0 || bulkTotal > 50 || bulkRun?.running}
              onClick={() => setBulkConfirmOpen(true)}
            >
              {bulkRun?.running ? "Replaying…" : `Replay ${bulkTotal || ""} selected`}
            </button>
          </div>
        </div>
        <textarea
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono"
          rows={2}
          placeholder="Paste log IDs (UUIDs) or provider message IDs…"
          value={pastedIds}
          onChange={(e) => setPastedIds(e.target.value)}
        />
        {bulkTotal > 50 ? (
          <p className="text-xs text-red-700">
            Too many items ({bulkTotal}). Trim your selection to 50 or fewer.
          </p>
        ) : null}
      </section>

      {bulkRun
        ? (() => {
            const items = bulkRun.items;
            const total = items.length;
            const done = items.filter((i) => i.status === "ok" || i.status === "error").length;
            const ok = items.filter((i) => i.status === "ok").length;
            const failed = items.filter((i) => i.status === "error").length;
            const running = items.find((i) => i.status === "running");
            const pct = total === 0 ? 100 : Math.round((done / total) * 100);
            // Per-recipient summary (only meaningful once done).
            const perRecipient = new Map<string, { ok: number; failed: number; last?: string }>();
            for (const it of items) {
              const key = it.recipient ?? "(unresolved)";
              const cur = perRecipient.get(key) ?? { ok: 0, failed: 0 };
              if (it.status === "ok") cur.ok++;
              else if (it.status === "error") {
                cur.failed++;
                if (it.error) cur.last = it.error;
              }
              perRecipient.set(key, cur);
            }
            const elapsed = (bulkRun.finishedAt ?? Date.now()) - (bulkRun.startedAt ?? Date.now());
            return (
              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {bulkRun.running
                        ? bulkRun.cancelRequested
                          ? "Stopping bulk replay…"
                          : `Bulk replay in progress · ${done}/${total}`
                        : `Bulk replay complete · ${ok} ok · ${failed} failed`}
                    </div>
                    <div className="text-xs text-sky-800/80">
                      {bulkRun.running && running
                        ? `Now sending → ${running.recipient ?? running.input} (${running.template ?? "—"})`
                        : `Elapsed ${(elapsed / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bulkRun.running ? (
                      <button
                        className="rounded-md border border-sky-300 bg-white px-2 py-1 text-xs font-medium hover:bg-sky-100 disabled:opacity-50"
                        disabled={bulkRun.cancelRequested}
                        onClick={() => setBulkRun((s) => (s ? { ...s, cancelRequested: true } : s))}
                      >
                        Stop after current
                      </button>
                    ) : (
                      <button className="underline" onClick={() => setBulkRun(null)}>
                        dismiss
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sky-100">
                  <div
                    className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                {/* Live per-item stream */}
                <ul className="mt-3 max-h-52 overflow-auto rounded border border-sky-100 bg-white/60 text-xs">
                  {items.map((it, idx) => {
                    const icon =
                      it.status === "ok"
                        ? "✓"
                        : it.status === "error"
                          ? "✗"
                          : it.status === "running"
                            ? "…"
                            : "•";
                    const color =
                      it.status === "ok"
                        ? "text-emerald-700"
                        : it.status === "error"
                          ? "text-red-700"
                          : it.status === "running"
                            ? "text-sky-700"
                            : "text-slate-500";
                    return (
                      <li
                        key={`${it.input}-${idx}`}
                        className="flex items-start justify-between gap-3 border-b border-sky-100/70 px-2 py-1 last:border-0"
                      >
                        <span className={`font-mono ${color}`}>
                          {icon} {it.recipient ?? it.input}
                          {it.template ? (
                            <span className="ml-2 text-slate-500">· {it.template}</span>
                          ) : null}
                        </span>
                        <span className="text-slate-500">
                          {it.status === "ok" && it.durationMs
                            ? `${it.durationMs}ms`
                            : it.status === "error"
                              ? (it.error ?? "error").slice(0, 60)
                              : it.status === "running"
                                ? "running"
                                : "queued"}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* Final per-recipient summary */}
                {!bulkRun.running ? (
                  <div className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                      Per-recipient summary
                    </div>
                    <ul className="mt-1 max-h-40 overflow-auto rounded border border-sky-100 bg-white/60 text-xs">
                      {[...perRecipient.entries()].map(([recipient, s]) => (
                        <li
                          key={recipient}
                          className="flex items-start justify-between gap-3 border-b border-sky-100/70 px-2 py-1 last:border-0"
                        >
                          <span className="font-mono">{recipient}</span>
                          <span className="text-slate-600">
                            <span className="text-emerald-700">{s.ok} ok</span>
                            {" · "}
                            <span className={s.failed > 0 ? "text-red-700" : ""}>
                              {s.failed} failed
                            </span>
                            {s.last ? (
                              <span className="ml-2 text-slate-500" title={s.last}>
                                — {s.last.slice(0, 40)}
                                {s.last.length > 40 ? "…" : ""}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })()
        : null}

      {/* Table */}
      <section className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all visible"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Attempts</th>
                <th className="px-3 py-2">Message ID</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !listQ.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No deliveries match these filters.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select delivery ${r.id}`}
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-3 py-2">{statusBadge(String(r.status), r.attempts ?? 0)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.template}</td>
                  <td className="px-3 py-2">{r.recipient}</td>
                  <td className="px-3 py-2 tabular-nums">{r.attempts}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.provider_message_id ? (
                      <button
                        onClick={() => {
                          setMessageId(String(r.provider_message_id));
                          setPage(0);
                        }}
                        className="hover:underline"
                        title="Filter by this message ID"
                      >
                        {String(r.provider_message_id).slice(0, 16)}…
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => setSelectedId(r.id)}
                    >
                      Details
                    </button>{" "}
                    <button
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      disabled={replay.isPending}
                      onClick={() => setConfirmId(r.id)}
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 text-sm">
          <span className="text-muted-foreground">
            Page {page + 1} · showing {rows.length}
          </span>
          <div className="space-x-2">
            <button
              className="rounded-md border px-2 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← Prev
            </button>
            <button
              className="rounded-md border px-2 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
              disabled={rows.length < limit}
            >
              Next →
            </button>
          </div>
        </div>
      </section>

      {/* Detail drawer */}
      {selectedId ? (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelectedId(null)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Delivery detail</h2>
                <p className="text-xs text-muted-foreground font-mono">{selectedId}</p>
              </div>
              <button className="text-sm underline" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>

            {detailQ.isLoading ? (
              <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
            ) : detailQ.data ? (
              <div className="mt-4 space-y-5 text-sm">
                <dl className="grid grid-cols-3 gap-y-1.5">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="col-span-2">
                    {statusBadge(String(detailQ.data.log.status), detailQ.data.log.attempts ?? 0)}
                  </dd>
                  <dt className="text-muted-foreground">Template</dt>
                  <dd className="col-span-2 font-mono text-xs">{detailQ.data.log.template}</dd>
                  <dt className="text-muted-foreground">Subject</dt>
                  <dd className="col-span-2">{detailQ.data.log.subject ?? "—"}</dd>
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd className="col-span-2">{detailQ.data.log.recipient}</dd>
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd className="col-span-2">{detailQ.data.log.provider}</dd>
                  <dt className="text-muted-foreground">Message ID</dt>
                  <dd className="col-span-2 font-mono text-xs break-all">
                    {detailQ.data.log.provider_message_id ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Attempts</dt>
                  <dd className="col-span-2">{detailQ.data.log.attempts}</dd>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="col-span-2">{fmt(detailQ.data.log.created_at)}</dd>
                  <dt className="text-muted-foreground">Sent</dt>
                  <dd className="col-span-2">{fmt(detailQ.data.log.sent_at)}</dd>
                  <dt className="text-muted-foreground">Failed</dt>
                  <dd className="col-span-2">{fmt(detailQ.data.log.failed_at)}</dd>
                </dl>

                {detailQ.data.log.last_error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold uppercase text-red-800">Last error</div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-red-900">
                      {detailQ.data.log.last_error}
                    </pre>
                  </div>
                ) : null}

                {detailQ.data.replayOf ? (
                  <div className="text-xs">
                    Replay of{" "}
                    <button
                      className="font-mono underline"
                      onClick={() => setSelectedId(detailQ.data!.replayOf!)}
                    >
                      {detailQ.data.replayOf}
                    </button>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Provider events ({detailQ.data.events.length})
                  </div>
                  <ul className="mt-2 space-y-1">
                    {detailQ.data.events.length === 0 ? (
                      <li className="text-xs text-muted-foreground">No events yet.</li>
                    ) : null}
                    {detailQ.data.events.map((e) => (
                      <li key={e.id} className="rounded border p-2 text-xs">
                        <div className="flex justify-between">
                          <span className="font-mono">{e.event_type}</span>
                          <span className="text-muted-foreground">{fmt(e.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Replays ({detailQ.data.replays.length})
                  </div>
                  <ul className="mt-2 space-y-1">
                    {detailQ.data.replays.length === 0 ? (
                      <li className="text-xs text-muted-foreground">No replays yet.</li>
                    ) : null}
                    {detailQ.data.replays.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between rounded border p-2 text-xs"
                      >
                        <div>
                          <div>{statusBadge(String(r.status), r.attempts ?? 0)}</div>
                          <div className="text-muted-foreground">{fmt(r.created_at)}</div>
                        </div>
                        <button className="underline font-mono" onClick={() => setSelectedId(r.id)}>
                          {r.id.slice(0, 8)}…
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                    disabled={replay.isPending}
                    onClick={() => setConfirmId(selectedId)}
                  >
                    {replay.isPending ? "Replaying…" : "Replay this send"}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {/* Replay confirm */}
      {confirmId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
            <h3 className="text-base font-semibold">Replay this delivery?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A new send will be dispatched to the original recipient using the same template. If
              stored template data isn't available, sample data is used. A new log row will be
              created and linked back to this delivery.
            </p>
            <p className="mt-2 font-mono text-xs break-all">{confirmId}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => setConfirmId(null)}
                disabled={replay.isPending}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                disabled={replay.isPending}
                onClick={async () => {
                  const id = confirmId;
                  setConfirmId(null);
                  await replay.mutateAsync(id);
                }}
              >
                {replay.isPending ? "Replaying…" : "Replay send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bulk replay confirm */}
      {bulkConfirmOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-background p-5 shadow-xl">
            <h3 className="text-base font-semibold">Replay {bulkTotal} deliveries?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Each selected message will be resent to its original recipient using the same
              template. New log rows will be created and linked back to the originals. This can take
              a while and may consume rate-limit quota.
            </p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div>
                Selected rows: <strong>{selectedIds.size}</strong>
              </div>
              <div>
                Pasted log IDs: <strong>{pastedLogIds.length}</strong>
              </div>
              <div>
                Pasted message IDs: <strong>{pastedMessageIds.length}</strong>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => setBulkConfirmOpen(false)}
                disabled={bulkRun?.running}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                disabled={bulkRun?.running || bulkTotal === 0}
                onClick={() => void runBulkReplay({ ids: bulkIds, messageIds: pastedMessageIds })}
              >
                {bulkRun?.running ? "Replaying…" : `Replay ${bulkTotal}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
