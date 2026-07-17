import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileText, Play, Receipt, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminDataTable, type Column } from "./data-table";
import {
  listSuccessFeeStatements,
  finalizeSuccessFeeStatement,
  issueSuccessFeeInvoice,
  addSuccessFeeAdjustment,
  voidSuccessFeeStatement,
  runMonthlySuccessFeeBuild,
  type SuccessFeeStatementRow,
} from "@/lib/success-fee.functions";

function money(cents: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function statusChip(s: SuccessFeeStatementRow["status"]) {
  const cls =
    s === "paid"
      ? "text-emerald-500"
      : s === "invoiced"
        ? "text-blue-500"
        : s === "finalized"
          ? "text-amber-500"
          : s === "voided"
            ? "text-muted-foreground"
            : "text-foreground";
  return <span className={`text-xs font-medium capitalize ${cls}`}>{s}</span>;
}

export function SuccessFeePanel() {
  const listFn = useServerFn(listSuccessFeeStatements);
  const finalizeFn = useServerFn(finalizeSuccessFeeStatement);
  const invoiceFn = useServerFn(issueSuccessFeeInvoice);
  const adjustFn = useServerFn(addSuccessFeeAdjustment);
  const voidFn = useServerFn(voidSuccessFeeStatement);
  const buildFn = useServerFn(runMonthlySuccessFeeBuild);
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<
    "all" | SuccessFeeStatementRow["status"]
  >("all");
  const [busy, setBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<SuccessFeeStatementRow | null>(null);


  const { data = [], isLoading } = useQuery<SuccessFeeStatementRow[]>({
    queryKey: ["admin-success-fee-statements"],
    queryFn: () => listFn({}),
    refetchInterval: 60_000,
  });

  const rows = useMemo(
    () => (statusFilter === "all" ? data : data.filter((r) => r.status === statusFilter)),
    [data, statusFilter],
  );

  const totals = useMemo(() => {
    return data.reduce(
      (acc, r) => {
        acc.recovered += r.recovered_amount_cents;
        acc.fees += r.net_amount_cents;
        if (r.status === "paid") acc.paid += r.net_amount_cents;
        if (r.status === "invoiced") acc.outstanding += r.net_amount_cents;
        return acc;
      },
      { recovered: 0, fees: 0, paid: 0, outstanding: 0 },
    );
  }, [data]);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-success-fee-statements"] });
  }

  async function onBuildPrev() {
    setBusy(true);
    try {
      const res = await buildFn({});
      toast.success(
        `Built ${res.statementsCreated} new + ${res.statementsUpdated} updated statements for ${res.period.label}.`,
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Build failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onFinalize(r: SuccessFeeStatementRow) {
    try {
      await finalizeFn({ data: { id: r.id } });
      toast.success("Statement finalized.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finalize failed.");
    }
  }

  async function onInvoice(r: SuccessFeeStatementRow) {
    try {
      const res = await invoiceFn({ data: { id: r.id } });
      toast.success("Invoice issued.");
      window.open(res.checkoutUrl, "_blank", "noreferrer,noopener");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invoice failed.");
    }
  }

  const columns: Column<SuccessFeeStatementRow>[] = [
    {
      key: "period_start",
      label: "Period",
      sortable: true,
      value: (r) => r.period_start,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.period_start.slice(0, 7)}</div>
          <div className="text-xs text-muted-foreground">
            {r.events_count} events · {(r.fee_bps / 100).toFixed(1)}%
          </div>
        </div>
      ),
    },
    {
      key: "organization_name",
      label: "Customer",
      value: (r) => r.organization_name ?? r.workspace_name ?? "",
      cell: (r) => (
        <div>
          <div className="text-xs font-medium">{r.organization_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{r.workspace_name ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "recovered_amount_cents",
      label: "Recovered",
      sortable: true,
      value: (r) => r.recovered_amount_cents,
      cell: (r) => (
        <span className="text-xs">{money(r.recovered_amount_cents, r.currency)}</span>
      ),
    },
    {
      key: "fee_amount_cents",
      label: "Fee",
      sortable: true,
      value: (r) => r.fee_amount_cents,
      cell: (r) => <span className="text-xs">{money(r.fee_amount_cents, r.currency)}</span>,
    },
    {
      key: "adjustments_total_cents",
      label: "Adj.",
      value: (r) => r.adjustments_total_cents,
      cell: (r) => (
        <span className="text-xs">
          {r.adjustments_total_cents === 0
            ? "—"
            : money(r.adjustments_total_cents, r.currency)}
        </span>
      ),
    },
    {
      key: "net_amount_cents",
      label: "Net due",
      sortable: true,
      value: (r) => r.net_amount_cents,
      cell: (r) => (
        <span className="text-xs font-semibold">
          {money(r.net_amount_cents, r.currency)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => statusChip(r.status),
    },
    {
      key: "actions",
      label: "",
      value: () => "",
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-1">
          {r.status === "draft" || r.status === "finalized" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setAdjustOpen(r)}
            >
              Adjust
            </Button>
          ) : null}
          {r.status === "draft" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => onFinalize(r)}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Finalize
            </Button>
          ) : null}
          {r.status === "finalized" ? (
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onInvoice(r)}
            >
              <Receipt className="mr-1 h-3 w-3" />
              Issue invoice
            </Button>
          ) : null}
          {r.status === "invoiced" && r.ls_checkout_url ? (
            <a
              href={r.ls_checkout_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-primary underline"
            >
              Open
            </a>
          ) : null}
          {r.status !== "voided" && r.status !== "paid" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-500"
              onClick={() => setVoidOpen(r)}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Void
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recovered (all-time)" value={money(totals.recovered)} />
        <StatCard label="Net fees" value={money(totals.fees)} />
        <StatCard label="Outstanding invoices" value={money(totals.outstanding)} accent />
        <StatCard label="Paid" value={money(totals.paid)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Status:</span>
          {(["all", "draft", "finalized", "invoiced", "paid", "voided"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
          {isLoading ? <span className="text-muted-foreground">Loading…</span> : null}
        </div>
        <Button size="sm" onClick={onBuildPrev} disabled={busy} className="gap-1">
          <Play className="size-3.5" />
          {busy ? "Building…" : "Build previous month"}
        </Button>
      </div>

      <AdminDataTable<SuccessFeeStatementRow>
        title="Success fee statements"
        description="Monthly settlement of the success fee charged on recovered revenue."
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={["organization_name", "workspace_name", "ls_invoice_id"]}
        exportFilename="success_fee_statements.csv"
      />

      {adjustOpen ? (
        <AdjustmentDialog
          statement={adjustOpen}
          onClose={() => setAdjustOpen(null)}
          onSubmit={async (payload) => {
            try {
              await adjustFn({ data: { ...payload, statementId: adjustOpen.id } });
              toast.success("Adjustment recorded.");
              setAdjustOpen(null);
              await refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Adjustment failed.");
            }
          }}
        />
      ) : null}

      {voidOpen ? (
        <ConfirmDialog
          open={!!voidOpen}
          onOpenChange={(o) => (!o ? setVoidOpen(null) : undefined)}
          title="Void this statement?"
          description="It will be marked voided and cannot be invoiced. Provide a reason for the audit log."
          confirmLabel="Void statement"
          destructive
          requireReason
          onConfirm={async (reason) => {
            try {
              await voidFn({ data: { id: voidOpen.id, reason: reason ?? "voided" } });
              toast.success("Statement voided.");
              setVoidOpen(null);
              await refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Void failed.");
            }
          }}
        />
      ) : null}
    </section>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function AdjustmentDialog({
  statement,
  onClose,
  onSubmit,
}: {
  statement: SuccessFeeStatementRow;
  onClose: () => void;
  onSubmit: (payload: {
    kind: "credit" | "debit" | "refund" | "manual";
    amount_cents: number;
    reason: string;
  }) => Promise<void>;
}) {
  const [kind, setKind] = useState<"credit" | "debit" | "refund" | "manual">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Adjust statement {statement.period_start.slice(0, 7)}
          </h3>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <div className="mt-1 flex gap-1">
              {(["credit", "debit", "refund", "manual"] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={kind === k ? "default" : "outline"}
                  onClick={() => setKind(k)}
                >
                  {k}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Amount (in {statement.currency}, cents)
            </label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500 = $5.00"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Goodwill credit for outage"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !amount || !reason || Number(amount) < 1}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({
                  kind,
                  amount_cents: Math.max(1, Number(amount)),
                  reason,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
