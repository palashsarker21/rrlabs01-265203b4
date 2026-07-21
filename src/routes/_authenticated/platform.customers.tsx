import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";

import { AdminDataTable, type Column } from "@/components/admin/data-table";
import { ManageDropdown } from "@/components/admin/v2/manage-dropdown";
import { listCustomers } from "@/lib/admin/customers.functions";

export const Route = createFileRoute("/_authenticated/admin/v2/customers")({
  component: CustomersPage,
  head: () => ({
    meta: [
      { title: "Customers — Platform Control Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Row = Awaited<ReturnType<typeof listCustomers>>[number];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  trial: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  setup: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  paused: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  suspended: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  cancelled: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  expired: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  archived: "bg-muted text-muted-foreground border-border/60",
  pending: "bg-muted text-muted-foreground border-border/60",
};

function StatusBadge({ value }: { value: string }) {
  const cls = STATUS_STYLES[value] ?? "bg-muted text-muted-foreground border-border/60";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs capitalize ${cls}`}
    >
      {value}
    </span>
  );
}

function money(cents: number | null | undefined) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(cents ?? 0) / 100);
}

function CustomersPage() {
  const list = useServerFn(listCustomers);
  const [status, setStatus] = useState("");
  const [engine, setEngine] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", { status, engine }],
    queryFn: () =>
      list({
        data: {
          status: (status || undefined) as never,
          engine: (engine || undefined) as never,
          limit: 500,
        },
      }),
    refetchInterval: 30_000,
  });

  const rows: Row[] = data ?? [];
  const totals = {
    count: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    trial: rows.filter((r) => r.status === "trial").length,
    engineOn: rows.filter((r) => r.recovery_engine_enabled).length,
    recovered: rows.reduce((s, r) => s + Number(r.recovered_amount_cents ?? 0), 0),
  };

  const columns: Column<Row>[] = [
    {
      key: "workspace_name",
      label: "Workspace",
      sortable: true,
      value: (r) => r.workspace_name,
      cell: (r) => (
        <Link
          to="/admin/v2/customers/$id"
          params={{ id: r.workspace_id }}
          className="group flex flex-col leading-tight"
        >
          <span className="font-medium text-foreground group-hover:underline">
            {r.workspace_name}
          </span>
          <span className="text-xs text-muted-foreground">{r.workspace_slug}</span>
        </Link>
      ),
    },
    {
      key: "organization_name",
      label: "Organization",
      sortable: true,
      value: (r) => r.organization_name,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "recovery_engine_enabled",
      label: "Engine",
      sortable: true,
      value: (r) => (r.recovery_engine_enabled ? "on" : "off"),
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
            r.recovery_engine_enabled
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
              : "border-border/60 bg-muted text-muted-foreground"
          }`}
        >
          {r.recovery_engine_enabled ? "On" : "Off"}
        </span>
      ),
    },
    {
      key: "members_count",
      label: "Members",
      align: "right",
      sortable: true,
      value: (r) => Number(r.members_count ?? 0),
    },
    {
      key: "active_integrations_count",
      label: "Integrations",
      align: "right",
      sortable: true,
      value: (r) => `${r.active_integrations_count}/${r.integrations_count}`,
      cell: (r) => (
        <span className="tabular-nums text-sm">
          {r.active_integrations_count}
          <span className="text-muted-foreground">/{r.integrations_count}</span>
        </span>
      ),
    },
    {
      key: "events_count",
      label: "Events",
      align: "right",
      sortable: true,
      value: (r) => Number(r.events_count ?? 0),
    },
    {
      key: "recovered_amount_cents",
      label: "Recovered",
      align: "right",
      sortable: true,
      value: (r) => Number(r.recovered_amount_cents ?? 0),
      cell: (r) => (
        <span className="tabular-nums font-medium">{money(r.recovered_amount_cents)}</span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {new Date(r.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground">
              Directory of every workspace on the platform. Manage status, engine, trials, and more.
            </p>
          </div>
        </div>
      </header>

      <section aria-label="Directory totals" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total" value={totals.count} />
        <Stat label="Active" value={totals.active} />
        <Stat label="Trial" value={totals.trial} />
        <Stat label="Engine on" value={totals.engineOn} />
        <Stat label="Recovered" value={money(totals.recovered)} accent />
      </section>

      <AdminDataTable<Row>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.workspace_id}
        searchKeys={["workspace_name", "workspace_slug", "organization_name", "workspace_id"]}
        filters={[
          {
            key: "status",
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { value: "", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "trial", label: "Trial" },
              { value: "setup", label: "Setup" },
              { value: "paused", label: "Paused" },
              { value: "suspended", label: "Suspended" },
              { value: "cancelled", label: "Cancelled" },
              { value: "expired", label: "Expired" },
              { value: "archived", label: "Archived" },
            ],
          },
          {
            key: "engine",
            label: "Engine",
            value: engine,
            onChange: setEngine,
            options: [
              { value: "", label: "Any engine" },
              { value: "on", label: "Engine on" },
              { value: "off", label: "Engine off" },
            ],
          },
        ]}
        rowActions={(r) => <ManageDropdown row={r} />}
        exportFilename="customers.csv"
        emptyMessage={isLoading ? "Loading customers…" : "No customers match the current filters."}
        pageSize={25}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
