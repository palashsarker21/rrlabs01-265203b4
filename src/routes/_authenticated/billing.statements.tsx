import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, ExternalLink, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  listSuccessFeeStatements,
  exportSuccessFeeCsv,
  type SuccessFeeStatementRow,
} from "@/lib/success-fee.functions";

export const Route = createFileRoute("/_authenticated/billing/statements")({
  component: StatementsPage,
  head: () => ({
    meta: [{ title: "Success fee statements — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    workspaceId: typeof search.workspaceId === "string" ? search.workspaceId : undefined,
  }),
});

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function statusClass(s: SuccessFeeStatementRow["status"]) {
  switch (s) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-500";
    case "invoiced":
      return "bg-blue-500/15 text-blue-500";
    case "finalized":
      return "bg-amber-500/15 text-amber-500";
    case "voided":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-foreground";
  }
}

function StatementsPage() {
  const navigate = useNavigate();
  const { workspaceId } = Route.useSearch();
  const list = useServerFn(listSuccessFeeStatements);
  const exportCsv = useServerFn(exportSuccessFeeCsv);

  const { data = [], isLoading } = useQuery({
    queryKey: ["success-fee-statements", workspaceId ?? "all"],
    queryFn: () => list({ data: workspaceId ? { workspaceId } : {} }),
  });

  async function onExport() {
    const res = await exportCsv({ data: workspaceId ? { workspaceId } : {} });
    const blob = new Blob([res.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `success-fee-statements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Success fee statements</h1>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/app" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Monthly settlement of the success fee charged on recovered revenue.
          </p>
          <Button size="sm" variant="outline" onClick={onExport} disabled={data.length === 0}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/50">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Recovered</th>
                <th className="px-4 py-3 text-right">Fee</th>
                <th className="px-4 py-3 text-right">Adjustments</th>
                <th className="px-4 py-3 text-right">Net due</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No statements yet. Your first statement will appear on the 1st of next month.
                  </td>
                </tr>
              ) : (
                data.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {new Date(s.period_start).toISOString().slice(0, 7)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.events_count} recovered event
                        {s.events_count === 1 ? "" : "s"} · {(s.fee_bps / 100).toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(s.recovered_amount_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(s.fee_amount_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.adjustments_total_cents === 0
                        ? "—"
                        : money(s.adjustments_total_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {money(s.net_amount_cents, s.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${statusClass(s.status)}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.ls_checkout_url ? (
                        <a
                          href={s.ls_checkout_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-xs text-primary underline"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Fees are calculated on the previous UTC calendar month and settled via Lemon Squeezy. See{" "}
          <Link to="/refund" className="underline">
            our refund policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
