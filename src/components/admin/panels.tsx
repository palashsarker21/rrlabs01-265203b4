/**
 * Admin console module panels — one component per operational module.
 *
 * Each panel uses the shared AdminDataTable for search/sort/paginate/CSV export.
 * Destructive actions are wrapped in ConfirmDialog. All data comes from
 * server functions in `src/lib/admin/ops.functions.ts` that gate on
 * `is_super_admin(auth.uid())`.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, ShieldCheck, ShieldOff, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminDataTable, type Column } from "./data-table";
import { ConfirmDialog } from "./confirm-dialog";
import {
  listAdminUsers,
  setUserRole,
  listAdminSubscriptions,
  listAdminWebhookLogs,
  listAdminIntegrations,
  forceDisconnectIntegration,
  listAdminRecoveryEvents,
  listAdminNotifications,
  listAdminBillingEvents,
  listAdminContactLeads,
  getSystemHealth,
  listAdminSettings,
  setAdminSetting,
  expireTrialsNow,
  listAdminBlogPosts,
} from "@/lib/admin/ops.functions";

function money(cents: number | null | undefined, currency = "USD") {
  const n = Number(cents ?? 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n / 100);
}
function fmt(ts: string | null | undefined) {
  return ts ? new Date(ts).toLocaleString() : "—";
}

// ============================================================
// USERS & ROLES
// ============================================================
export function UsersPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminUsers);
  const setRole = useServerFn(setUserRole);
  const { data = [] } = useQuery({ queryKey: ["admin-users"], queryFn: () => list({}) });

  async function toggleRole(userId: string, role: "super_admin" | "admin", has: boolean) {
    try {
      await setRole({ data: { userId, role, grant: !has } });
      toast.success(`Role ${!has ? "granted" : "revoked"}.`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  }

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    {
      key: "email",
      label: "Email",
      sortable: true,
      value: (r) => r.email,
      cell: (r) => (
        <div>
          <div className="font-medium text-foreground">{r.email}</div>
          <div className="text-xs text-muted-foreground">{r.display_name ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "roles",
      label: "Roles",
      value: (r) => (r.roles ?? []).join(", "),
      cell: (r) =>
        (r.roles ?? []).length ? (
          <div className="flex flex-wrap gap-1">
            {r.roles.map((role) => (
              <span
                key={role}
                className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                {role}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">none</span>
        ),
    },
    {
      key: "created_at",
      label: "Joined",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>,
    },
  ];

  return (
    <AdminDataTable
      title="Users & roles"
      description="Grant or revoke platform roles. Changes are audit-logged."
      rows={data}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["email", "display_name"]}
      exportFilename="users.csv"
      rowActions={(r) => {
        const isSuper = (r.roles ?? []).includes("super_admin");
        const isAdmin = (r.roles ?? []).includes("admin");
        return (
          <div className="flex justify-end gap-1">
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" className="h-7">
                  {isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  <span className="ml-1 text-xs">{isAdmin ? "Revoke admin" : "Grant admin"}</span>
                </Button>
              }
              title={`${isAdmin ? "Revoke" : "Grant"} admin role?`}
              description={`${isAdmin ? "Remove" : "Add"} the admin role for ${r.email}.`}
              confirmLabel={isAdmin ? "Revoke" : "Grant"}
              onConfirm={() => toggleRole(r.id, "admin", isAdmin)}
            />
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" className="h-7">
                  {isSuper ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  <span className="ml-1 text-xs">{isSuper ? "Revoke super" : "Grant super"}</span>
                </Button>
              }
              title={`${isSuper ? "Revoke" : "Grant"} super admin?`}
              description={`This gives ${r.email} full platform access. Proceed carefully.`}
              confirmLabel={isSuper ? "Revoke" : "Grant"}
              onConfirm={() => toggleRole(r.id, "super_admin", isSuper)}
            />
          </div>
        );
      }}
    />
  );
}

// ============================================================
// SUBSCRIPTIONS
// ============================================================
export function SubscriptionsPanel() {
  const list = useServerFn(listAdminSubscriptions);
  const { data = [] } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: () => list({}),
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(
    () => (statusFilter === "all" ? data : data.filter((s) => s.status === statusFilter)),
    [data, statusFilter],
  );

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    {
      key: "workspace",
      label: "Workspace",
      sortable: true,
      value: (r) => r.workspace?.name ?? "",
      cell: (r) => r.workspace?.name ?? "—",
    },
    {
      key: "plan",
      label: "Plan",
      sortable: true,
      value: (r) => r.plan?.code ?? "",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.plan?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {r.plan ? money(r.plan.price_cents, r.plan.currency ?? "USD") : "—"} / {r.plan?.interval ?? "?"}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{r.status}</span>,
    },
    {
      key: "card",
      label: "Card",
      cell: (r) => (r.card_brand ? `${r.card_brand} •••• ${r.card_last_four ?? ""}` : "—"),
    },
    {
      key: "renews_at",
      label: "Renews",
      sortable: true,
      value: (r) => r.renews_at,
      cell: (r) => <span className="text-xs">{fmt(r.renews_at)}</span>,
    },
  ];

  return (
    <AdminDataTable
      title="Subscriptions"
      description="All customer subscriptions across the platform."
      rows={filtered}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["ls_subscription_id"]}
      filters={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "on_trial", label: "Trial" },
            { value: "past_due", label: "Past due" },
            { value: "cancelled", label: "Cancelled" },
            { value: "expired", label: "Expired" },
          ],
        },
      ]}
      exportFilename="subscriptions.csv"
    />
  );
}

// ============================================================
// WEBHOOK MONITOR
// ============================================================
export function WebhookMonitorPanel() {
  const list = useServerFn(listAdminWebhookLogs);
  const { data = [] } = useQuery({
    queryKey: ["admin-webhook-logs"],
    queryFn: () => list({ data: { limit: 500 } }),
    refetchInterval: 30_000,
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(() => {
    if (statusFilter === "all") return data;
    if (statusFilter === "errors") return data.filter((w) => w.error);
    if (statusFilter === "invalid") return data.filter((w) => !w.signature_valid);
    return data.filter((w) => w.provider_code === statusFilter);
  }, [data, statusFilter]);

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    {
      key: "received_at",
      label: "Received",
      sortable: true,
      value: (r) => r.received_at,
      cell: (r) => <span className="text-xs">{fmt(r.received_at)}</span>,
    },
    { key: "provider_code", label: "Provider", sortable: true, value: (r) => r.provider_code },
    { key: "event_type", label: "Event", cell: (r) => r.event_type ?? "—" },
    {
      key: "signature_valid",
      label: "Signature",
      cell: (r) =>
        r.signature_valid ? (
          <span className="text-xs text-emerald-500">valid</span>
        ) : (
          <span className="text-xs text-rose-500">invalid</span>
        ),
    },
    { key: "status_code", label: "HTTP", align: "right", value: (r) => r.status_code },
    { key: "attempt_count", label: "Attempts", align: "right", value: (r) => r.attempt_count },
    {
      key: "error",
      label: "Error",
      value: (r) => r.error,
      cell: (r) => (
        <span className="text-xs text-rose-500">{r.error ? r.error.slice(0, 80) : "—"}</span>
      ),
    },
  ];

  const providers = useMemo(() => Array.from(new Set(data.map((r) => r.provider_code))), [data]);

  return (
    <AdminDataTable
      title="Webhook monitor"
      description="Last 500 webhook deliveries — refreshes every 30 seconds."
      rows={filtered}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["event_type", "provider_code"]}
      filters={[
        {
          key: "kind",
          label: "Filter",
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: "all", label: "All webhooks" },
            { value: "errors", label: "With errors" },
            { value: "invalid", label: "Invalid signature" },
            ...providers.map((p) => ({ value: p, label: p })),
          ],
        },
      ]}
      exportFilename="webhook_logs.csv"
    />
  );
}

// ============================================================
// INTEGRATIONS
// ============================================================
export function IntegrationsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminIntegrations);
  const disconnect = useServerFn(forceDisconnectIntegration);
  const { data = [] } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: () => list({}),
  });

  async function handleDisconnect(id: string) {
    try {
      await disconnect({ data: { integrationId: id } });
      toast.success("Integration disconnected.");
      qc.invalidateQueries({ queryKey: ["admin-integrations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  }

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    { key: "provider", label: "Provider", sortable: true, value: (r) => r.provider },
    { key: "kind", label: "Kind", sortable: true, value: (r) => r.kind },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{r.status}</span>,
    },
    {
      key: "verification_status",
      label: "Verification",
      sortable: true,
      value: (r) => r.verification_status,
      cell: (r) => <span className="text-xs capitalize">{r.verification_status}</span>,
    },
    {
      key: "last_verified_at",
      label: "Last verified",
      sortable: true,
      value: (r) => r.last_verified_at,
      cell: (r) => <span className="text-xs">{fmt(r.last_verified_at)}</span>,
    },
    {
      key: "workspace_id",
      label: "Workspace",
      value: (r) => r.workspace_id,
      cell: (r) => <code className="text-xs">{r.workspace_id?.slice(0, 8) ?? "—"}</code>,
    },
  ];

  return (
    <AdminDataTable
      title="Integrations"
      description="All integrations across all workspaces."
      rows={data}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["provider_code", "workspace_id"]}
      exportFilename="integrations.csv"
      rowActions={(r) => (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline" className="h-7">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Disconnect</span>
            </Button>
          }
          title="Force disconnect?"
          description={`This will disconnect the ${r.provider} integration. The workspace will need to reconnect it manually.`}
          confirmLabel="Disconnect"
          onConfirm={() => handleDisconnect(r.id)}
        />
      )}
    />
  );
}

// ============================================================
// RECOVERY ENGINE
// ============================================================
export function RecoveryPanel() {
  const list = useServerFn(listAdminRecoveryEvents);
  const { data = [] } = useQuery({
    queryKey: ["admin-recovery"],
    queryFn: () => list({}),
    refetchInterval: 60_000,
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(
    () => (statusFilter === "all" ? data : data.filter((r) => r.status === statusFilter)),
    [data, statusFilter],
  );

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => <span className="text-xs">{fmt(r.created_at)}</span>,
    },
    { key: "provider", label: "Provider", sortable: true, value: (r) => r.provider },
    { key: "failure_category", label: "Failure", value: (r) => r.failure_category ?? "" },
    {
      key: "amount_cents",
      label: "Amount",
      align: "right",
      sortable: true,
      value: (r) => r.amount_cents,
      cell: (r) => money(r.amount_cents, r.currency ?? "USD"),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{r.status}</span>,
    },
    {
      key: "recovered_at",
      label: "Recovered",
      value: (r) => r.recovered_at,
      cell: (r) => <span className="text-xs">{fmt(r.recovered_at)}</span>,
    },
  ];

  return (
    <AdminDataTable
      title="Recovery engine"
      description="Recovery events across all workspaces. Auto-refreshes every 60s."
      rows={filtered}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["customer_email", "provider_code"]}
      filters={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: "all", label: "All statuses" },
            { value: "recovered", label: "Recovered" },
            { value: "processing", label: "Processing" },
            { value: "failed", label: "Failed" },
            { value: "abandoned", label: "Abandoned" },
          ],
        },
      ]}
      exportFilename="recovery_events.csv"
    />
  );
}

// ============================================================
// NOTIFICATION QUEUES (Email + WhatsApp + SMS)
// ============================================================
export function NotificationsPanel({ channel }: { channel: "email" | "whatsapp" | "sms" | "all" }) {
  const list = useServerFn(listAdminNotifications);
  const { data = [] } = useQuery({
    queryKey: ["admin-notifications", channel],
    queryFn: () => list({ data: { channel } }),
    refetchInterval: 45_000,
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(
    () => (statusFilter === "all" ? data : data.filter((n) => n.status === statusFilter)),
    [data, statusFilter],
  );

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    {
      key: "created_at",
      label: "Sent",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => <span className="text-xs">{fmt(r.created_at)}</span>,
    },
    { key: "channel", label: "Channel", sortable: true, value: (r) => r.channel },
    { key: "kind", label: "Kind", sortable: true, value: (r) => r.kind },
    { key: "recipient", label: "Recipient", value: (r) => r.recipient ?? "" },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => (
        <span
          className={`rounded px-2 py-0.5 text-xs capitalize ${
            r.status === "sent"
              ? "bg-emerald-500/15 text-emerald-500"
              : r.status === "failed"
                ? "bg-rose-500/15 text-rose-500"
                : "bg-muted"
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: "error",
      label: "Error",
      value: (r) => r.error,
      cell: (r) => <span className="text-xs text-rose-500">{r.error ? r.error.slice(0, 60) : "—"}</span>,
    },
  ];

  const label =
    channel === "email"
      ? "Email queue"
      : channel === "whatsapp"
        ? "WhatsApp queue"
        : channel === "sms"
          ? "SMS queue"
          : "Notifications";

  return (
    <AdminDataTable
      title={label}
      description="Recent notification deliveries. Auto-refreshes every 45s."
      rows={filtered}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["recipient", "kind"]}
      filters={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: "all", label: "All statuses" },
            { value: "queued", label: "Queued" },
            { value: "sent", label: "Sent" },
            { value: "failed", label: "Failed" },
            { value: "suppressed", label: "Suppressed" },
          ],
        },
      ]}
      exportFilename={`${channel}_notifications.csv`}
    />
  );
}

// ============================================================
// BILLING EVENTS
// ============================================================
export function BillingEventsPanel() {
  const list = useServerFn(listAdminBillingEvents);
  const { data = [] } = useQuery({
    queryKey: ["admin-billing-events"],
    queryFn: () => list({}),
    refetchInterval: 60_000,
  });

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    {
      key: "created_at",
      label: "Received",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => <span className="text-xs">{fmt(r.created_at)}</span>,
    },
    { key: "event_name", label: "Event", sortable: true, value: (r) => r.event_name },
    { key: "event_id", label: "Provider ID", value: (r) => r.event_id },
    {
      key: "processed_at",
      label: "Processed",
      value: (r) => r.processed_at,
      cell: (r) =>
        r.processed_at ? (
          <span className="text-xs text-emerald-500">{fmt(r.processed_at)}</span>
        ) : r.error ? (
          <span className="text-xs text-rose-500">error</span>
        ) : (
          <span className="text-xs text-amber-500">pending</span>
        ),
    },
    {
      key: "error",
      label: "Error",
      value: (r) => r.error,
      cell: (r) => <span className="text-xs text-rose-500">{r.error?.slice(0, 80) ?? "—"}</span>,
    },
  ];

  return (
    <AdminDataTable
      title="Billing events"
      description="LemonSqueezy webhook events."
      rows={data}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["event_name", "event_id"]}
      exportFilename="billing_events.csv"
    />
  );
}

// ============================================================
// SUPPORT CENTER (contact leads)
// ============================================================
export function SupportPanel() {
  const list = useServerFn(listAdminContactLeads);
  const { data = [] } = useQuery({
    queryKey: ["admin-contact-leads"],
    queryFn: () => list({}),
  });

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    {
      key: "created_at",
      label: "Received",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => <span className="text-xs">{fmt(r.created_at)}</span>,
    },
    {
      key: "name",
      label: "Contact",
      sortable: true,
      value: (r) => r.name,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">{r.email}</div>
        </div>
      ),
    },
    { key: "company", label: "Company", value: (r) => r.company ?? "" },
    { key: "arr_range", label: "ARR", value: (r) => r.arr_range ?? "" },
    { key: "plan_code", label: "Plan", value: (r) => r.plan_code ?? "" },
    { key: "source", label: "Source", value: (r) => r.source ?? "" },
    {
      key: "use_case",
      label: "Use case",
      value: (r) => r.use_case,
      cell: (r) => <span className="text-xs">{r.use_case?.slice(0, 120) ?? "—"}</span>,
    },
  ];

  return (
    <AdminDataTable
      title="Support & sales inbox"
      description="Contact form submissions and sales enquiries."
      rows={data}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["name", "email", "company"]}
      exportFilename="contact_leads.csv"
    />
  );
}

// ============================================================
// SYSTEM HEALTH
// ============================================================
export function SystemHealthPanel() {
  const health = useServerFn(getSystemHealth);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: () => health({}),
    refetchInterval: 30_000,
  });

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">System health</h3>
            <p className="text-xs text-muted-foreground">
              Auto-refreshes every 30s • last checked {data ? fmt(data.timestamp) : "—"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <HealthStat
            label="Database"
            value={data ? `${data.database.latencyMs}ms` : "—"}
            good={!!data?.database.ok}
          />
          <HealthStat
            label="Webhook errors (1h)"
            value={data?.last1h.webhookErrors ?? 0}
            good={(data?.last1h.webhookErrors ?? 0) === 0}
          />
          <HealthStat
            label="Notification failures (1h)"
            value={data?.last1h.notificationFailures ?? 0}
            good={(data?.last1h.notificationFailures ?? 0) === 0}
          />
          <HealthStat
            label="Providers monitored"
            value={data?.providers.length ?? 0}
            good={(data?.providers.length ?? 0) > 0}
          />
        </div>
      </div>

      {data && data.providers.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/50">
          <div className="border-b border-border/60 p-4">
            <h3 className="text-sm font-semibold">Provider status</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Last ping</th>
                <th className="px-4 py-2 text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => (
                <tr key={p.provider_code} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs">{p.provider_code}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs capitalize ${
                        p.status === "operational"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-rose-500/15 text-rose-500"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{fmt(p.last_ping_at)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{p.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HealthStat({ label, value, good }: { label: string; value: React.ReactNode; good: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        good ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

// ============================================================
// GLOBAL SETTINGS
// ============================================================
export function SettingsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminSettings);
  const setFn = useServerFn(setAdminSetting);
  const { data = [] } = useQuery({ queryKey: ["admin-settings"], queryFn: () => list({}) });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function save(key: string, raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast.error("Value must be valid JSON.");
      return;
    }
    try {
      await setFn({ data: { key, value: parsed } });
      toast.success("Setting saved.");
      setDrafts((d) => {
        const { [key]: _, ...rest } = d;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50">
      <div className="border-b border-border/60 p-4">
        <h3 className="text-sm font-semibold text-foreground">Global settings</h3>
        <p className="text-xs text-muted-foreground">
          Runtime configuration stored in the database. Every save is audit-logged.
        </p>
      </div>
      <div className="divide-y divide-border/60">
        {data.map((s) => {
          const current = drafts[s.key] ?? JSON.stringify(s.value, null, 2);
          const dirty = drafts[s.key] !== undefined;
          return (
            <div key={s.key} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm font-medium">{s.key}</div>
                  {s.description && (
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Updated {fmt(s.updated_at)}</span>
              </div>
              <Textarea
                value={current}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                rows={3}
                className="font-mono text-xs"
              />
              {dirty && (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={() => save(s.key, current)}>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No settings defined.</div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// MAINTENANCE TOOLS
// ============================================================
export function MaintenancePanel() {
  const expire = useServerFn(expireTrialsNow);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function runExpire() {
    try {
      const r = await expire({});
      setLastResult(`Expired ${r.affected} trial workspace(s).`);
      toast.success(`Expired ${r.affected} trial(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-6">
      <h3 className="text-sm font-semibold text-foreground">Maintenance tools</h3>
      <p className="text-xs text-muted-foreground">
        Manually trigger scheduled jobs. All actions are audit-logged.
      </p>
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-4">
          <div>
            <div className="text-sm font-medium">Expire ended trials</div>
            <div className="text-xs text-muted-foreground">
              Marks workspaces whose trial_ends_at is in the past as `expired`.
            </div>
          </div>
          <ConfirmDialog
            trigger={<Button size="sm">Run now</Button>}
            title="Expire ended trials?"
            description="This immediately transitions all past-trial workspaces to expired. Users will be blocked from paid features."
            destructive={false}
            confirmLabel="Run"
            onConfirm={runExpire}
          />
        </div>
        {lastResult && (
          <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500">{lastResult}</div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// BLOG MODERATION
// ============================================================
export function BlogModerationPanel() {
  const list = useServerFn(listAdminBlogPosts);
  const { data = [] } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: () => list({}),
  });

  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    { key: "title", label: "Title", sortable: true, value: (r) => r.title },
    { key: "slug", label: "Slug", value: (r) => r.slug },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => (
        <span
          className={`rounded px-2 py-0.5 text-xs capitalize ${
            r.status === "published"
              ? "bg-emerald-500/15 text-emerald-500"
              : r.status === "draft"
                ? "bg-muted"
                : "bg-amber-500/15 text-amber-500"
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: "published_at",
      label: "Published",
      sortable: true,
      value: (r) => r.published_at,
      cell: (r) => <span className="text-xs">{fmt(r.published_at)}</span>,
    },
    {
      key: "updated_at",
      label: "Updated",
      sortable: true,
      value: (r) => r.updated_at,
      cell: (r) => <span className="text-xs">{fmt(r.updated_at)}</span>,
    },
  ];

  return (
    <AdminDataTable
      title="Blog moderation"
      description="All posts in the database. Full CMS lives at /admin/blog."
      rows={data}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["title", "slug"]}
      exportFilename="blog_posts.csv"
    />
  );
}

// ============================================================
// SECURITY CENTER
// ============================================================
export function SecurityCenterPanel() {
  const users = useServerFn(listAdminUsers);
  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => users({}),
  });
  const [q, setQ] = useState("");

  const superAdmins = allUsers.filter((u) => (u.roles ?? []).includes("super_admin"));
  const admins = allUsers.filter((u) => (u.roles ?? []).includes("admin"));

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
        <h3 className="text-sm font-semibold text-foreground">Security center</h3>
        <p className="text-xs text-muted-foreground">
          Elevated-role inventory and platform hardening summary. Detailed vulnerability scans are surfaced by the security scanner in the More menu.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <HealthStat label="Super admins" value={superAdmins.length} good={superAdmins.length <= 3} />
          <HealthStat label="Admins" value={admins.length} good={true} />
          <HealthStat label="Total users" value={allUsers.length} good={true} />
          <HealthStat
            label="Elevated / total"
            value={`${Math.round(((superAdmins.length + admins.length) / Math.max(1, allUsers.length)) * 100)}%`}
            good={superAdmins.length + admins.length <= Math.max(3, allUsers.length * 0.1)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50">
        <div className="border-b border-border/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Users with elevated roles</h3>
              <p className="text-xs text-muted-foreground">
                Manage grants from the Users tab; this is a read-only registry.
              </p>
            </div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter…"
              className="h-8 w-56 text-xs"
            />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Roles</th>
              <th className="px-4 py-2 text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {[...superAdmins, ...admins]
              .filter((u) => !q || u.email?.toLowerCase().includes(q.toLowerCase()))
              .map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-medium">{u.email}</td>
                  <td className="px-4 py-2">
                    {u.roles.map((r) => (
                      <span key={r} className="mr-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {r}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{fmt(u.created_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// ANALYTICS DASHBOARD (recovery + subs + churn aggregates)
// ============================================================
export function AnalyticsPanel() {
  const recoveryList = useServerFn(listAdminRecoveryEvents);
  const subsList = useServerFn(listAdminSubscriptions);
  const { data: recovery = [] } = useQuery({
    queryKey: ["admin-recovery"],
    queryFn: () => recoveryList({}),
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: () => subsList({}),
  });

  const stats = useMemo(() => {
    const recoveredCount = recovery.filter((r) => r.status === "recovered").length;
    const failedCount = recovery.filter((r) => r.status === "failed").length;
    const totalValue = recovery
      .filter((r) => r.status === "recovered")
      .reduce((s, r) => s + Number(r.amount_cents ?? 0), 0);
    const activeSubs = subs.filter((s) => s.status === "active").length;
    const trialSubs = subs.filter((s) => s.status === "on_trial").length;
    const cancelled = subs.filter((s) => s.status === "cancelled").length;
    const recoveryRate = recovery.length > 0 ? recoveredCount / recovery.length : 0;
    return {
      recoveredCount,
      failedCount,
      totalValue,
      activeSubs,
      trialSubs,
      cancelled,
      recoveryRate,
    };
  }, [recovery, subs]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
        <h3 className="text-sm font-semibold text-foreground">Platform analytics</h3>
        <p className="text-xs text-muted-foreground">Aggregate view across all workspaces.</p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <HealthStat label="Recovered value" value={money(stats.totalValue)} good={true} />
          <HealthStat
            label="Recovery rate"
            value={`${Math.round(stats.recoveryRate * 100)}%`}
            good={stats.recoveryRate > 0.3}
          />
          <HealthStat label="Recovered events" value={stats.recoveredCount} good={true} />
          <HealthStat label="Failed events" value={stats.failedCount} good={stats.failedCount === 0} />
          <HealthStat label="Active subs" value={stats.activeSubs} good={stats.activeSubs > 0} />
          <HealthStat label="Trials" value={stats.trialSubs} good={true} />
          <HealthStat label="Cancelled" value={stats.cancelled} good={true} />
          <HealthStat
            label="Total events"
            value={recovery.length}
            good={true}
          />
        </div>
      </div>
    </section>
  );
}
