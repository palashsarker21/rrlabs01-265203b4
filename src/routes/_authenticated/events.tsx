import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  Filter as FilterIcon,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  searchRecoveryEvents,
  exportRecoveryEvents,
  type RecoveryEventRow,
  type RecoveryAttemptRow,
} from "@/lib/recovery-events-search.functions";
import { listRecoveryAttempts } from "@/lib/recovery.functions";

export const Route = createFileRoute("/_authenticated/events")({
  component: EventsViewer,
  head: () => ({
    meta: [{ title: "Recovery events — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-rose-500" role="alert">
      Failed to load events: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm text-muted-foreground">Not found.</div>,
});

const STATUS_OPTIONS = [
  "new",
  "analyzing",
  "recovering",
  "recovered",
  "failed",
  "abandoned",
] as const;
const CHANNEL_OPTIONS = ["email", "sms", "whatsapp", "push"] as const;
const PROVIDER_OPTIONS = ["stripe", "paypal", "shopify", "woocommerce", "lemonsqueezy"] as const;

const STATUS_STYLES: Record<string, string> = {
  recovered: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  new: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  analyzing: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30",
  recovering: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  failed: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  abandoned: "bg-muted text-muted-foreground border-muted",
};

function money(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency ?? "USD").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventsViewer() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState<string>(daysAgoIso(30));
  const [toDate, setToDate] = useState<string>(todayIso());
  const [statuses, setStatuses] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [openEvent, setOpenEvent] = useState<RecoveryEventRow | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ["workspaces-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const activeWorkspace = workspaces?.[0];

  const searchFn = useServerFn(searchRecoveryEvents);
  const exportFn = useServerFn(exportRecoveryEvents);
  const attemptsFn = useServerFn(listRecoveryAttempts);

  const filterPayload = useMemo(
    () => ({
      workspaceId: activeWorkspace?.id ?? "",
      from: fromDate ? new Date(fromDate + "T00:00:00Z").toISOString() : undefined,
      to: toDate ? new Date(toDate + "T23:59:59Z").toISOString() : undefined,
      statuses: statuses.length ? statuses : undefined,
      channels: channels.length ? channels : undefined,
      providers: providers.length ? providers : undefined,
      search: search || undefined,
      minAmountCents: minAmount ? Math.round(Number(minAmount) * 100) : undefined,
      maxAmountCents: maxAmount ? Math.round(Number(maxAmount) * 100) : undefined,
    }),
    [
      activeWorkspace?.id,
      fromDate,
      toDate,
      statuses,
      channels,
      providers,
      search,
      minAmount,
      maxAmount,
    ],
  );

  const query = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["events-search", filterPayload, page],
    queryFn: () => searchFn({ data: { ...filterPayload, page, pageSize } }),
  });

  const attemptsQuery = useQuery({
    enabled: !!openEvent,
    queryKey: ["event-attempts", openEvent?.id],
    queryFn: () => attemptsFn({ data: { eventId: openEvent!.id } }),
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / pageSize)) : 1;

  const resetFilters = () => {
    setStatuses([]);
    setChannels([]);
    setProviders([]);
    setSearch("");
    setSearchInput("");
    setMinAmount("");
    setMaxAmount("");
    setFromDate(daysAgoIso(30));
    setToDate(todayIso());
    setPage(1);
  };

  const activeFilterCount =
    statuses.length +
    channels.length +
    providers.length +
    (search ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0);

  async function handleExportCsv() {
    if (!activeWorkspace) return;
    setExporting("csv");
    try {
      const { events, attempts } = await exportFn({ data: { ...filterPayload, maxRows: 10000 } });
      const header = [
        "event_id",
        "created_at",
        "status",
        "provider",
        "object_type",
        "external_object_id",
        "amount",
        "currency",
        "failure_category",
        "failure_code",
        "failure_message",
        "attempts_count",
        "recovered_at",
        "customer_email",
        "customer_name",
      ];
      const eventLines = [header.join(",")];
      for (const e of events) {
        eventLines.push(
          [
            e.id,
            e.created_at,
            e.status,
            e.provider,
            e.object_type,
            e.external_object_id,
            e.amount_cents != null ? (e.amount_cents / 100).toFixed(2) : "",
            e.currency,
            e.failure_category,
            e.failure_code,
            e.failure_message,
            e.attempts_count,
            e.recovered_at,
            e.customer?.email,
            e.customer?.name,
          ]
            .map(csvEscape)
            .join(","),
        );
      }

      const attemptHeader = [
        "event_id",
        "attempt_id",
        "step",
        "channel",
        "status",
        "to_address",
        "subject",
        "scheduled_for",
        "sent_at",
        "delivered_at",
        "error",
      ];
      const attemptLines = [attemptHeader.join(",")];
      for (const eid of Object.keys(attempts)) {
        for (const a of attempts[eid]) {
          attemptLines.push(
            [
              eid,
              a.id,
              a.step,
              a.channel,
              a.status,
              a.to_address,
              a.subject,
              a.scheduled_for,
              a.sent_at,
              a.delivered_at,
              a.error,
            ]
              .map(csvEscape)
              .join(","),
          );
        }
      }

      const csv = `# Recovery events (${events.length})\n${eventLines.join("\n")}\n\n# Recovery attempts\n${attemptLines.join("\n")}\n`;
      downloadBlob(
        `recovery-events_${fromDate}_${toDate}.csv`,
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      toast.success(`Exported ${events.length} events to CSV`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    if (!activeWorkspace) return;
    setExporting("pdf");
    try {
      const { events, attempts } = await exportFn({
        data: { ...filterPayload, maxRows: 2000 },
      });
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      doc.setFontSize(16);
      doc.text("Recovery events report", 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${activeWorkspace.name} · ${fromDate} to ${toDate} · ${events.length} events`,
        40,
        58,
      );
      const filterLines: string[] = [];
      if (statuses.length) filterLines.push(`Statuses: ${statuses.join(", ")}`);
      if (channels.length) filterLines.push(`Channels: ${channels.join(", ")}`);
      if (providers.length) filterLines.push(`Providers: ${providers.join(", ")}`);
      if (search) filterLines.push(`Search: "${search}"`);
      if (minAmount || maxAmount)
        filterLines.push(`Amount: ${minAmount || "0"} – ${maxAmount || "∞"}`);
      if (filterLines.length) doc.text(filterLines.join(" · "), 40, 72);

      const recovered = events.filter((e) => e.status === "recovered");
      const recoveredCents = recovered.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
      const currency = events.find((e) => e.currency)?.currency ?? "USD";
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.text(
        `Recovered: ${recovered.length} / ${events.length} · ${money(recoveredCents, currency)}`,
        40,
        90,
      );

      autoTable(doc, {
        startY: 105,
        head: [["Date", "Status", "Provider", "Amount", "Failure", "Attempts", "Customer"]],
        body: events.map((e) => [
          new Date(e.created_at).toLocaleDateString(),
          e.status,
          e.provider ?? "",
          money(e.amount_cents, e.currency),
          e.failure_category
            ? `${e.failure_category}${e.failure_code ? ` (${e.failure_code})` : ""}`
            : (e.failure_code ?? ""),
          String(e.attempts_count ?? 0),
          e.customer?.email ?? e.customer?.name ?? "",
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [16, 185, 129] },
        columnStyles: {
          4: { cellWidth: 180 },
          6: { cellWidth: 140 },
        },
      });

      // Attempts appendix (only up to 400 attempts to keep the PDF manageable)
      const flatAttempts: (RecoveryAttemptRow & { eventId: string })[] = [];
      for (const eid of Object.keys(attempts)) {
        for (const a of attempts[eid]) flatAttempts.push({ ...a, eventId: eid });
      }
      if (flatAttempts.length) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Attempts", 40, 40);
        autoTable(doc, {
          startY: 55,
          head: [["Event", "Step", "Channel", "Status", "To", "Sent", "Delivered", "Error"]],
          body: flatAttempts
            .slice(0, 400)
            .map((a) => [
              a.eventId.slice(0, 8),
              String(a.step),
              a.channel,
              a.status,
              a.to_address ?? "",
              a.sent_at ? new Date(a.sent_at).toLocaleString() : "",
              a.delivered_at ? new Date(a.delivered_at).toLocaleString() : "",
              a.error ?? "",
            ]),
          styles: { fontSize: 7, cellPadding: 3 },
          headStyles: { fillColor: [16, 185, 129] },
        });
        if (flatAttempts.length > 400) {
          const finalY =
            (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(
            `Showing first 400 of ${flatAttempts.length} attempts. Export CSV for full data.`,
            40,
            finalY + 20,
          );
        }
      }

      doc.save(`recovery-events_${fromDate}_${toDate}.pdf`);
      toast.success(`Exported ${events.length} events to PDF`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  if (wsLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">No workspace available.</p>
        <Button asChild size="sm" className="mt-4">
          <Link to="/app">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/app" })}
              className="gap-1"
            >
              <ArrowLeft className="size-4" /> Dashboard
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Recovery events</h1>
              <p className="text-xs text-muted-foreground">
                {activeWorkspace.name} · {query.data?.total ?? 0} matching events
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting !== null || !query.data?.total}
            >
              <Download className="mr-2 size-4" />
              {exporting === "csv" ? "Exporting…" : "CSV"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting !== null || !query.data?.total}
            >
              <FileText className="mr-2 size-4" />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {/* Filter bar */}
        <section className="rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[150px]"
              />
            </div>

            <FilterMenu
              label="Status"
              options={STATUS_OPTIONS as unknown as string[]}
              selected={statuses}
              onChange={(v) => {
                setStatuses(v);
                setPage(1);
              }}
            />
            <FilterMenu
              label="Channel"
              options={CHANNEL_OPTIONS as unknown as string[]}
              selected={channels}
              onChange={(v) => {
                setChannels(v);
                setPage(1);
              }}
            />
            <FilterMenu
              label="Provider"
              options={PROVIDER_OPTIONS as unknown as string[]}
              selected={providers}
              onChange={(v) => {
                setProviders(v);
                setPage(1);
              }}
            />

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Min amount</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[100px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Max amount</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="∞"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[100px]"
              />
            </div>

            <form
              className="flex flex-1 flex-col gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput.trim());
                setPage(1);
              }}
            >
              <label className="text-[11px] font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Message, code, order id…"
                  className="h-9 pl-8"
                />
              </div>
            </form>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={activeFilterCount === 0 && !searchInput}
              className="h-9"
            >
              <X className="mr-1 size-4" /> Reset
            </Button>
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <FilterIcon className="size-3.5 text-muted-foreground" />
              {statuses.map((s) => (
                <Chip key={"s" + s} onRemove={() => setStatuses(statuses.filter((x) => x !== s))}>
                  status: {s}
                </Chip>
              ))}
              {channels.map((s) => (
                <Chip key={"c" + s} onRemove={() => setChannels(channels.filter((x) => x !== s))}>
                  channel: {s}
                </Chip>
              ))}
              {providers.map((s) => (
                <Chip key={"p" + s} onRemove={() => setProviders(providers.filter((x) => x !== s))}>
                  provider: {s}
                </Chip>
              ))}
              {search && (
                <Chip
                  onRemove={() => {
                    setSearch("");
                    setSearchInput("");
                  }}
                >
                  “{search}”
                </Chip>
              )}
              {minAmount && <Chip onRemove={() => setMinAmount("")}>≥ {minAmount}</Chip>}
              {maxAmount && <Chip onRemove={() => setMaxAmount("")}>≤ {maxAmount}</Chip>}
            </div>
          )}
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Provider</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-left font-medium">Failure</th>
                  <th className="px-3 py-2 text-left font-medium">Customer</th>
                  <th className="px-3 py-2 text-right font-medium">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Loading events…
                    </td>
                  </tr>
                )}
                {!query.isLoading && (query.data?.rows.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      No events match these filters.
                    </td>
                  </tr>
                )}
                {query.data?.rows.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setOpenEvent(e)}
                    className="cursor-pointer border-t hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {fmtDate(e.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[e.status] ?? "border-muted"}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{e.provider ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                      {money(e.amount_cents, e.currency)}
                    </td>
                    <td className="max-w-[280px] px-3 py-2 text-xs">
                      <div className="truncate">
                        {e.failure_category && (
                          <Badge variant="outline" className="mr-1 text-[10px]">
                            {e.failure_category}
                          </Badge>
                        )}
                        {e.failure_message ?? e.failure_code ?? "—"}
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-xs">
                      <div className="truncate">{e.customer?.email ?? e.customer?.name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.attempts_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages} · {query.data?.total ?? 0} events
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || query.isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || query.isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Drill-down dialog */}
      <Dialog open={!!openEvent} onOpenChange={(o) => !o && setOpenEvent(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event detail</DialogTitle>
          </DialogHeader>
          {openEvent && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <Field label="Status">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[openEvent.status] ?? ""}`}
                  >
                    {openEvent.status}
                  </span>
                </Field>
                <Field label="Amount">{money(openEvent.amount_cents, openEvent.currency)}</Field>
                <Field label="Provider">{openEvent.provider ?? "—"}</Field>
                <Field label="Created">{fmtDate(openEvent.created_at)}</Field>
                <Field label="Recovered">{fmtDate(openEvent.recovered_at)}</Field>
                <Field label="Object">
                  <span className="font-mono text-xs">
                    {openEvent.object_type ?? ""} {openEvent.external_object_id ?? ""}
                  </span>
                </Field>
                <Field label="Customer">
                  {openEvent.customer?.email ?? openEvent.customer?.name ?? "—"}
                </Field>
                <Field label="Failure category">{openEvent.failure_category ?? "—"}</Field>
                <Field label="Failure code">{openEvent.failure_code ?? "—"}</Field>
              </div>

              {openEvent.failure_message && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Failure message</div>
                  <p className="mt-1 rounded bg-muted/50 p-2 text-sm">
                    {openEvent.failure_message}
                  </p>
                </div>
              )}
              {openEvent.ai_summary && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">AI summary</div>
                  <p className="mt-1 rounded bg-primary/5 p-2 text-sm">{openEvent.ai_summary}</p>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Attempts ({attemptsQuery.data?.length ?? openEvent.attempts_count})
                </h3>
                {attemptsQuery.isLoading && (
                  <p className="text-xs text-muted-foreground">Loading attempts…</p>
                )}
                {attemptsQuery.data && attemptsQuery.data.length === 0 && (
                  <p className="text-xs text-muted-foreground">No attempts recorded.</p>
                )}
                <ol className="space-y-2">
                  {attemptsQuery.data?.map((a) => (
                    <li key={a.id} className="rounded border bg-background p-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">#{a.step}</span>
                        <Badge variant="secondary">{a.channel}</Badge>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                            a.status === "delivered"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : a.status === "failed"
                                ? "bg-rose-500/15 text-rose-500"
                                : "bg-muted"
                          }`}
                        >
                          {a.status}
                        </span>
                        {a.to_address && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            → {a.to_address}
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {fmtDate(a.sent_at ?? a.created_at)}
                        </span>
                      </div>
                      {a.subject && <div className="mt-1 text-sm font-medium">{a.subject}</div>}
                      {a.body_text && (
                        <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">
                          {a.body_text}
                        </pre>
                      )}
                      {a.error && (
                        <div className="mt-1 rounded bg-rose-500/10 p-2 text-xs text-rose-500">
                          {a.error}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]">
      {children}
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        onClick={onRemove}
        aria-label="Remove filter"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[120px]">
            <span>
              {selected.length === 0 ? `All ${label.toLowerCase()}` : `${selected.length} selected`}
            </span>
            <FilterIcon className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((o) => (
            <DropdownMenuCheckboxItem
              key={o}
              checked={selected.includes(o)}
              onCheckedChange={(c) => {
                if (c) onChange([...selected, o]);
                else onChange(selected.filter((x) => x !== o));
              }}
              className="capitalize"
            >
              {o}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
