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
import { Trash2, ShieldCheck, ShieldOff, RefreshCw, Save, Play, XCircle, AlertOctagon } from "lucide-react";
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
import {
  listAdminJobs,
  getQueueStats,
  retryJob,
  moveJobToDlq,
  cancelJob,
  deleteJob,
  bulkRetryFailed,
  purgeDlq,
  type JobRow,
  type JobStatus,
  type QueueStat,
} from "@/lib/admin/queue.functions";

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
              <span key={role} className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
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
                  {isAdmin ? (
                    <ShieldOff className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
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
                  {isSuper ? (
                    <ShieldOff className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
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
            {r.plan ? money(r.plan.price_cents, r.plan.currency ?? "USD") : "—"} /{" "}
            {r.plan?.interval ?? "?"}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => (
        <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{r.status}</span>
      ),
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
      cell: (r) => (
        <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{r.status}</span>
      ),
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
      cell: (r) => (
        <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{r.status}</span>
      ),
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
      cell: (r) => (
        <span className="text-xs text-rose-500">{r.error ? r.error.slice(0, 60) : "—"}</span>
      ),
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
                <th className="px-4 py-2 text-left">Integration</th>
                <th className="px-4 py-2 text-left">Verification</th>
                <th className="px-4 py-2 text-left">Last delivery</th>
                <th className="px-4 py-2 text-left">Last error</th>
                <th className="px-4 py-2 text-right">Retries</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => (
                <tr key={p.integration_id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs">{p.integration_id.slice(0, 8)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs capitalize ${
                        p.verification_status === "verified"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {p.verification_status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{fmt(p.last_delivery_at)}</td>
                  <td className="px-4 py-2 text-xs text-rose-500">{p.last_error ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-xs">{p.retry_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HealthStat({
  label,
  value,
  good,
}: {
  label: string;
  value: React.ReactNode;
  good: boolean;
}) {
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
          <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500">
            {lastResult}
          </div>
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
          Elevated-role inventory and platform hardening summary. Detailed vulnerability scans are
          surfaced by the security scanner in the More menu.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <HealthStat
            label="Super admins"
            value={superAdmins.length}
            good={superAdmins.length <= 3}
          />
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
                      <span
                        key={r}
                        className="mr-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
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
          <HealthStat
            label="Failed events"
            value={stats.failedCount}
            good={stats.failedCount === 0}
          />
          <HealthStat label="Active subs" value={stats.activeSubs} good={stats.activeSubs > 0} />
          <HealthStat label="Trials" value={stats.trialSubs} good={true} />
          <HealthStat label="Cancelled" value={stats.cancelled} good={true} />
          <HealthStat label="Total events" value={recovery.length} good={true} />
        </div>
      </div>
    </section>
  );
}

// ============================================================
// GOD MODE — Enterprise kill switches (super admin only)
// ============================================================
const GOD_MODE_SWITCHES: Array<{
  key: string;
  label: string;
  description: string;
  /** When true, `enabled=true` is the DANGEROUS state (e.g. god_mode itself). Default: false — `enabled=false` is dangerous. */
  dangerousWhenOn?: boolean;
  group: "emergency" | "auth" | "billing" | "engine" | "channels" | "infra";
}> = [
  {
    key: "god_mode",
    label: "God Mode",
    description: "Master switch. When ON, super admin bypasses read-only and lockdown.",
    dangerousWhenOn: true,
    group: "emergency",
  },
  {
    key: "read_only_mode",
    label: "Read-Only Mode",
    description: "Rejects all write endpoints platform-wide.",
    dangerousWhenOn: true,
    group: "emergency",
  },
  {
    key: "lockdown_mode",
    label: "Emergency Lockdown",
    description: "Blocks all non-admin traffic.",
    dangerousWhenOn: true,
    group: "emergency",
  },
  {
    key: "maintenance_mode",
    label: "Maintenance Mode",
    description: "Shows maintenance banner to non-admins.",
    dangerousWhenOn: true,
    group: "emergency",
  },
  {
    key: "signups_enabled",
    label: "Signups",
    description: "New account registration.",
    group: "auth",
  },
  { key: "logins_enabled", label: "Logins", description: "Existing user sign-in.", group: "auth" },
  {
    key: "billing_enabled",
    label: "Billing",
    description: "Billing endpoints and webhooks.",
    group: "billing",
  },
  {
    key: "checkout_enabled",
    label: "Checkout",
    description: "Checkout session creation.",
    group: "billing",
  },
  {
    key: "recovery_engine_enabled",
    label: "Recovery Engine",
    description: "Global recovery orchestrator.",
    group: "engine",
  },
  {
    key: "ai_enabled",
    label: "AI Features",
    description: "All AI Gateway usage.",
    group: "engine",
  },
  {
    key: "webhooks_enabled",
    label: "Inbound Webhooks",
    description: "Provider webhook ingestion.",
    group: "engine",
  },
  { key: "api_enabled", label: "Public API", description: "External API access.", group: "engine" },
  {
    key: "email_enabled",
    label: "Email",
    description: "Outbound email dispatch.",
    group: "channels",
  },
  {
    key: "whatsapp_enabled",
    label: "WhatsApp",
    description: "Outbound WhatsApp dispatch.",
    group: "channels",
  },
  { key: "sms_enabled", label: "SMS", description: "Outbound SMS dispatch.", group: "channels" },
  {
    key: "background_jobs_enabled",
    label: "Background Jobs",
    description: "Queue workers.",
    group: "infra",
  },
  { key: "cron_enabled", label: "Cron", description: "Scheduled jobs.", group: "infra" },
];

const GROUP_LABEL: Record<string, string> = {
  emergency: "Emergency controls",
  auth: "Authentication",
  billing: "Billing & checkout",
  engine: "Platform engine",
  channels: "Notification channels",
  infra: "Infrastructure",
};

export function GodModePanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminSettings);
  const setFn = useServerFn(setAdminSetting);
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => list({}),
  });

  const byKey = useMemo(() => {
    const m = new Map<string, { enabled: boolean; updated_at: string }>();
    for (const s of data as Array<{ key: string; value: unknown; updated_at: string }>) {
      const v = (s.value ?? {}) as { enabled?: boolean };
      m.set(s.key, { enabled: v.enabled === true, updated_at: s.updated_at });
    }
    return m;
  }, [data]);

  async function toggle(key: string, next: boolean) {
    try {
      await setFn({ data: { key, value: { enabled: next } } });
      toast.success(`${key} → ${next ? "ON" : "OFF"}`);
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  }

  const grouped = useMemo(() => {
    const g: Record<string, typeof GOD_MODE_SWITCHES> = {};
    for (const s of GOD_MODE_SWITCHES) {
      (g[s.group] ??= []).push(s);
    }
    return g;
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldOff className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              God Mode — Platform kill switches
            </h3>
            <p className="text-xs text-muted-foreground">
              Every toggle takes effect immediately and is audit-logged. Confirmation is required
              for each change. Use only during incidents or planned maintenance.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Loading kill switches…
        </div>
      ) : (
        Object.entries(grouped).map(([group, switches]) => (
          <div key={group} className="rounded-2xl border border-border/60 bg-card/50">
            <div className="border-b border-border/60 p-4">
              <h4 className="text-sm font-semibold text-foreground">{GROUP_LABEL[group]}</h4>
            </div>
            <div className="divide-y divide-border/60">
              {switches.map((s) => {
                const cur = byKey.get(s.key);
                const on = cur?.enabled ?? false;
                const dangerous = s.dangerousWhenOn ? on : !on;
                const nextValue = !on;
                const nextDangerous = s.dangerousWhenOn ? nextValue : !nextValue;
                return (
                  <div key={s.key} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm font-medium">{s.label}</div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            dangerous
                              ? "bg-destructive/15 text-destructive"
                              : "bg-emerald-500/15 text-emerald-500"
                          }`}
                        >
                          {on ? "ON" : "OFF"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                      {cur?.updated_at && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          Last change {fmt(cur.updated_at)}
                        </div>
                      )}
                    </div>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant={nextDangerous ? "destructive" : "outline"}>
                          Turn {nextValue ? "ON" : "OFF"}
                        </Button>
                      }
                      title={`${nextValue ? "Enable" : "Disable"} ${s.label}?`}
                      description={
                        nextDangerous
                          ? `This is a DANGEROUS change. ${s.description} It will take effect immediately for the entire platform.`
                          : `${s.description} It will take effect immediately for the entire platform.`
                      }
                      destructive={nextDangerous}
                      confirmLabel={nextValue ? "Enable" : "Disable"}
                      onConfirm={() => toggle(s.key, nextValue)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

// ============================================================
// API KEYS
// ============================================================
import {
  listAdminApiKeys,
  createApiKey,
  rotateApiKey,
  setApiKeyDisabled,
  revokeApiKey,
  deleteApiKey,
  API_KEY_SCOPES,
} from "@/lib/admin/api-keys.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, KeyRound, Ban } from "lucide-react";

type ApiKeyRow = {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: "active" | "disabled" | "revoked";
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  disabled_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  request_count: number;
  created_at: string;
  created_by: string | null;
};

function CreateApiKeyDialog({ onCreated }: { onCreated: () => void }) {
  const create = useServerFn(createApiKey);
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read:workspace"]);
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await create({
        data: {
          workspaceId,
          name,
          scopes: scopes as (typeof API_KEY_SCOPES)[number][],
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        },
      });
      setIssuedToken(res.token);
      onCreated();
      toast.success("API key created. Copy it now — it won't be shown again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create key.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setWorkspaceId("");
    setName("");
    setScopes(["read:workspace"]);
    setExpiresInDays("");
    setIssuedToken(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <KeyRound className="size-3.5" /> New API key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            The raw token is shown exactly once. Store it in a password manager immediately.
          </DialogDescription>
        </DialogHeader>
        {issuedToken ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border/60 bg-background/60 p-3 font-mono text-xs break-all">
              {issuedToken}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => {
                void navigator.clipboard.writeText(issuedToken);
                toast.success("Copied.");
              }}
            >
              <Copy className="size-3.5" /> Copy to clipboard
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Workspace ID (UUID)
              </label>
              <Input
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production server"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Scopes</label>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {API_KEY_SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scopes.includes(s)}
                      onChange={(e) =>
                        setScopes((prev) =>
                          e.target.checked ? [...prev, s] : prev.filter((x) => x !== s),
                        )
                      }
                    />
                    <span className="font-mono">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Expires in days (blank = never)
              </label>
              <Input
                type="number"
                min="1"
                max="3650"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {issuedToken ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <Button
              onClick={submit}
              disabled={busy || !workspaceId || !name || scopes.length === 0}
            >
              {busy ? "Creating…" : "Create key"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminApiKeys);
  const rotate = useServerFn(rotateApiKey);
  const setDisabled = useServerFn(setApiKeyDisabled);
  const revoke = useServerFn(revokeApiKey);
  const del = useServerFn(deleteApiKey);
  const [statusFilter, setStatusFilter] = useState("");
  const { data = [] } = useQuery<ApiKeyRow[]>({
    queryKey: ["admin-api-keys"],
    queryFn: () => list({}) as Promise<ApiKeyRow[]>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-api-keys"] });

  async function doRotate(id: string) {
    try {
      const res = await rotate({ data: { id } });
      await navigator.clipboard.writeText(res.token).catch(() => undefined);
      toast.success("Rotated. New key copied to clipboard.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rotation failed.");
    }
  }
  async function doToggle(id: string, disabled: boolean) {
    try {
      await setDisabled({ data: { id, disabled } });
      toast.success(disabled ? "Key disabled." : "Key enabled.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    }
  }
  async function doRevoke(id: string) {
    try {
      await revoke({ data: { id } });
      toast.success("Key revoked.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revoke failed.");
    }
  }
  async function doDelete(id: string) {
    try {
      await del({ data: { id } });
      toast.success("Key deleted.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  const columns: Column<ApiKeyRow>[] = [
    { key: "name", label: "Name", sortable: true, value: (r) => r.name },
    {
      key: "prefix",
      label: "Prefix",
      value: (r) => r.key_prefix,
      cell: (r) => <span className="font-mono text-xs">{r.key_prefix}…</span>,
    },
    {
      key: "workspace_id",
      label: "Workspace",
      value: (r) => r.workspace_id,
      cell: (r) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {r.workspace_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "scopes",
      label: "Scopes",
      value: (r) => r.scopes.join(" "),
      cell: (r) => <span className="font-mono text-[10px]">{r.scopes.join(" ")}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => (
        <span
          className={
            r.status === "active"
              ? "text-emerald-500"
              : r.status === "disabled"
                ? "text-amber-500"
                : "text-destructive"
          }
        >
          {r.status}
        </span>
      ),
    },
    {
      key: "request_count",
      label: "Requests",
      align: "right",
      sortable: true,
      value: (r) => r.request_count,
    },
    {
      key: "last_used_at",
      label: "Last used",
      sortable: true,
      value: (r) => r.last_used_at ?? "",
      cell: (r) => fmt(r.last_used_at),
    },
    {
      key: "expires_at",
      label: "Expires",
      sortable: true,
      value: (r) => r.expires_at ?? "",
      cell: (r) => fmt(r.expires_at),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => fmt(r.created_at),
    },
  ];

  return (
    <AdminDataTable<ApiKeyRow>
      title="API Keys"
      description="Cryptographically hashed. Raw values are shown only at creation and never stored."
      rows={data}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["name", "key_prefix", "workspace_id"]}
      filters={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
            { value: "revoked", label: "Revoked" },
          ],
        },
      ]}
      exportFilename="api-keys"
      toolbarExtra={<CreateApiKeyDialog onCreated={invalidate} />}
      rowActions={(r) => (
        <div className="flex items-center gap-1">
          {r.status !== "revoked" && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1">
                  <RefreshCw className="size-3.5" /> Rotate
                </Button>
              }
              title="Rotate API key"
              description="A new key will be issued and this one will be revoked immediately. Any service still using the old key will break."
              confirmLabel="Rotate"
              destructive
              onConfirm={() => doRotate(r.id)}
            />
          )}
          {r.status === "active" && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1">
                  <ShieldOff className="size-3.5" /> Disable
                </Button>
              }
              title="Disable API key"
              description="The key will stop authenticating until re-enabled. No data is lost."
              confirmLabel="Disable"
              destructive
              onConfirm={() => doToggle(r.id, true)}
            />
          )}
          {r.status === "disabled" && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => doToggle(r.id, false)}
            >
              <ShieldCheck className="size-3.5" /> Enable
            </Button>
          )}
          {r.status !== "revoked" && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1 text-destructive">
                  <Ban className="size-3.5" /> Revoke
                </Button>
              }
              title="Revoke API key"
              description="Permanently invalidates this key. Cannot be undone."
              confirmLabel="Revoke"
              destructive
              onConfirm={() => doRevoke(r.id)}
            />
          )}
          {r.status === "revoked" && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1 text-destructive">
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              }
              title="Delete revoked API key"
              description="Removes the row entirely. Audit history is preserved separately."
              confirmLabel="Delete"
              destructive
              onConfirm={() => doDelete(r.id)}
            />
          )}
        </div>
      )}
    />
  );
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================
import {
  listAdminAnnouncements,
  upsertAnnouncement,
  setAnnouncementPublished,
  deleteAnnouncement,
} from "@/lib/announcements.functions";
import { Megaphone, Eye, EyeOff } from "lucide-react";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  kind: "banner" | "popup" | "release_note" | "maintenance";
  severity: "info" | "warning" | "critical";
  audience: string;
  cta_label: string | null;
  cta_href: string | null;
  starts_at: string | null;
  ends_at: string | null;
  dismissible: boolean;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

function AnnouncementEditor({
  initial,
  onSaved,
  trigger,
}: {
  initial?: Partial<AnnouncementRow> & { id?: string };
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const upsert = useServerFn(upsertAnnouncement);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    title: initial?.title ?? "",
    body: initial?.body ?? "",
    kind: (initial?.kind ?? "banner") as AnnouncementRow["kind"],
    severity: (initial?.severity ?? "info") as AnnouncementRow["severity"],
    audience: initial?.audience ?? "all",
    cta_label: initial?.cta_label ?? "",
    cta_href: initial?.cta_href ?? "",
    starts_at: initial?.starts_at ?? "",
    ends_at: initial?.ends_at ?? "",
    dismissible: initial?.dismissible ?? true,
    published: initial?.published ?? false,
  });

  async function submit() {
    setBusy(true);
    try {
      await upsert({
        data: {
          id: form.id,
          title: form.title,
          body: form.body,
          kind: form.kind,
          severity: form.severity,
          audience: form.audience as "all" | "authenticated" | "anonymous",
          audience_filter: {},
          cta_label: form.cta_label || null,
          cta_href: form.cta_href || null,
          starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
          dismissible: form.dismissible,
          published: form.published,
        },
      });
      toast.success(form.id ? "Announcement updated." : "Announcement created.");
      onSaved();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            Banners appear site-wide. Publishing is required for anything to display.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Body</label>
            <Textarea
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kind</label>
              <select
                className="w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-sm"
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as AnnouncementRow["kind"] })
                }
              >
                <option value="banner">Banner</option>
                <option value="popup">Popup</option>
                <option value="release_note">Release note</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Severity</label>
              <select
                className="w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-sm"
                value={form.severity}
                onChange={(e) =>
                  setForm({ ...form, severity: e.target.value as AnnouncementRow["severity"] })
                }
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Audience</label>
              <select
                className="w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-sm"
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="all">Everyone</option>
                <option value="authenticated">Signed in</option>
                <option value="anonymous">Signed out</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">CTA label</label>
              <Input
                value={form.cta_label}
                onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">CTA URL</label>
              <Input
                value={form.cta_href}
                onChange={(e) => setForm({ ...form, cta_href: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Starts at</label>
              <Input
                type="datetime-local"
                value={form.starts_at ? form.starts_at.slice(0, 16) : ""}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Ends at</label>
              <Input
                type="datetime-local"
                value={form.ends_at ? form.ends_at.slice(0, 16) : ""}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.dismissible}
                onChange={(e) => setForm({ ...form, dismissible: e.target.checked })}
              />
              Dismissible
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              Published
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || !form.title.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminAnnouncements);
  const setPublished = useServerFn(setAnnouncementPublished);
  const del = useServerFn(deleteAnnouncement);
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");

  const { data = [] } = useQuery<AnnouncementRow[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => list({}) as Promise<AnnouncementRow[]>,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements-active"] });
  };

  async function togglePublished(id: string, published: boolean) {
    try {
      await setPublished({ data: { id, published } });
      toast.success(published ? "Published." : "Unpublished.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    }
  }
  async function doDelete(id: string) {
    try {
      await del({ data: { id } });
      toast.success("Deleted.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  const filtered = data.filter(
    (r) =>
      (!statusFilter || (statusFilter === "published" ? r.published : !r.published)) &&
      (!kindFilter || r.kind === kindFilter),
  );

  const columns: Column<AnnouncementRow>[] = [
    { key: "title", label: "Title", sortable: true, value: (r) => r.title },
    { key: "kind", label: "Kind", sortable: true, value: (r) => r.kind },
    {
      key: "severity",
      label: "Severity",
      sortable: true,
      value: (r) => r.severity,
      cell: (r) => (
        <span
          className={
            r.severity === "critical"
              ? "text-destructive"
              : r.severity === "warning"
                ? "text-amber-500"
                : "text-muted-foreground"
          }
        >
          {r.severity}
        </span>
      ),
    },
    { key: "audience", label: "Audience", value: (r) => r.audience },
    {
      key: "published",
      label: "Published",
      sortable: true,
      value: (r) => (r.published ? "yes" : "no"),
      cell: (r) => (r.published ? <span className="text-emerald-500">yes</span> : "no"),
    },
    {
      key: "starts_at",
      label: "Starts",
      sortable: true,
      value: (r) => r.starts_at ?? "",
      cell: (r) => fmt(r.starts_at),
    },
    {
      key: "ends_at",
      label: "Ends",
      sortable: true,
      value: (r) => r.ends_at ?? "",
      cell: (r) => fmt(r.ends_at),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => fmt(r.created_at),
    },
  ];

  return (
    <AdminDataTable<AnnouncementRow>
      title="Announcements"
      description="Site-wide banners, popups, release notes, and maintenance notices."
      rows={filtered}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["title", "body"]}
      filters={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: "", label: "All" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
          ],
        },
        {
          key: "kind",
          label: "Kind",
          value: kindFilter,
          onChange: setKindFilter,
          options: [
            { value: "", label: "Any" },
            { value: "banner", label: "Banner" },
            { value: "popup", label: "Popup" },
            { value: "release_note", label: "Release note" },
            { value: "maintenance", label: "Maintenance" },
          ],
        },
      ]}
      exportFilename="announcements"
      toolbarExtra={
        <AnnouncementEditor
          onSaved={invalidate}
          trigger={
            <Button size="sm" className="gap-1">
              <Megaphone className="size-3.5" /> New announcement
            </Button>
          }
        />
      }
      rowActions={(r) => (
        <div className="flex items-center gap-1">
          <AnnouncementEditor
            initial={r}
            onSaved={invalidate}
            trigger={
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            }
          />
          {r.published ? (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1">
                  <EyeOff className="size-3.5" /> Unpublish
                </Button>
              }
              title="Unpublish announcement"
              description="It will stop showing to users immediately."
              confirmLabel="Unpublish"
              destructive={false}
              onConfirm={() => togglePublished(r.id, false)}
            />
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1">
                  <Eye className="size-3.5" /> Publish
                </Button>
              }
              title="Publish announcement"
              description="It will become visible to the selected audience within the active window."
              confirmLabel="Publish"
              destructive={false}
              onConfirm={() => togglePublished(r.id, true)}
            />
          )}
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="gap-1 text-destructive">
                <Trash2 className="size-3.5" /> Delete
              </Button>
            }
            title="Delete announcement"
            description="Permanent. Dismissal history is preserved via cascade."
            confirmLabel="Delete"
            destructive
            onConfirm={() => doDelete(r.id)}
          />
        </div>
      )}
    />
  );
}

// ============================================================
// INCIDENTS
// ============================================================
import {
  listAdminIncidents,
  listAdminIncidentUpdates,
  upsertIncident,
  addIncidentUpdate,
  deleteIncident,
  type IncidentStatus,
  type IncidentImpact,
} from "@/lib/incidents.functions";
import { AlertTriangle, MessageSquarePlus } from "lucide-react";

type IncidentRow = {
  id: string;
  title: string;
  summary: string | null;
  status: IncidentStatus;
  impact: IncidentImpact;
  affected_components: string[];
  started_at: string;
  resolved_at: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

const INCIDENT_STATUSES: IncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
];
const INCIDENT_IMPACTS: IncidentImpact[] = ["none", "minor", "major", "critical"];

function IncidentEditor({
  initial,
  onSaved,
  trigger,
}: {
  initial?: Partial<IncidentRow> & { id?: string };
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const upsert = useServerFn(upsertIncident);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    status: (initial?.status ?? "investigating") as IncidentStatus,
    impact: (initial?.impact ?? "minor") as IncidentImpact,
    affected_components: (initial?.affected_components ?? []).join(", "),
    started_at: initial?.started_at ?? "",
    resolved_at: initial?.resolved_at ?? "",
    is_public: initial?.is_public ?? true,
  });

  async function submit() {
    setBusy(true);
    try {
      await upsert({
        data: {
          id: form.id,
          title: form.title,
          summary: form.summary || null,
          status: form.status,
          impact: form.impact,
          affected_components: form.affected_components
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          started_at: form.started_at ? new Date(form.started_at).toISOString() : undefined,
          resolved_at: form.resolved_at ? new Date(form.resolved_at).toISOString() : null,
          is_public: form.is_public,
        },
      });
      toast.success(form.id ? "Incident updated." : "Incident created.");
      onSaved();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit incident" : "New incident"}</DialogTitle>
          <DialogDescription>
            Incidents appear on the public status page when marked public.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Title</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Summary</label>
            <Textarea
              rows={3}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Status</label>
              <select
                className="w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as IncidentStatus })}
              >
                {INCIDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Impact</label>
              <select
                className="w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-sm"
                value={form.impact}
                onChange={(e) => setForm({ ...form, impact: e.target.value as IncidentImpact })}
              >
                {INCIDENT_IMPACTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Affected components (comma separated)
            </label>
            <Input
              value={form.affected_components}
              onChange={(e) => setForm({ ...form, affected_components: e.target.value })}
              placeholder="API Server, Database"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Started at</label>
              <Input
                type="datetime-local"
                value={form.started_at ? form.started_at.slice(0, 16) : ""}
                onChange={(e) => setForm({ ...form, started_at: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Resolved at</label>
              <Input
                type="datetime-local"
                value={form.resolved_at ? form.resolved_at.slice(0, 16) : ""}
                onChange={(e) => setForm({ ...form, resolved_at: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
            />
            Public (visible on status page)
          </label>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || !form.title.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncidentUpdateDialog({
  incidentId,
  onSaved,
  trigger,
}: {
  incidentId: string;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const add = useServerFn(addIncidentUpdate);
  const listUpdates = useServerFn(listAdminIncidentUpdates);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<IncidentStatus>("investigating");
  const [message, setMessage] = useState("");

  const { data: updates = [], refetch } = useQuery({
    enabled: open,
    queryKey: ["admin-incident-updates", incidentId],
    queryFn: () => listUpdates({ data: { incidentId } }),
  });

  async function submit() {
    setBusy(true);
    try {
      await add({ data: { incidentId, status, message } });
      toast.success("Update posted.");
      setMessage("");
      await refetch();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Post failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post incident update</DialogTitle>
          <DialogDescription>
            Timeline entries are appended and immediately visible on the status page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Status</label>
            <select
              className="w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
            >
              {INCIDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Message</label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={busy || message.trim().length < 2}>
            {busy ? "Posting…" : "Post update"}
          </Button>
          <div className="border-t border-border/60 pt-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Timeline
            </div>
            <div className="space-y-2 text-sm">
              {(updates as Array<{
                id: string;
                status: string;
                message: string;
                created_at: string;
              }>).map((u) => (
                <div key={u.id} className="rounded border border-border/60 p-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono uppercase">{u.status}</span>
                    <span>{fmt(u.created_at)}</span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{u.message}</div>
                </div>
              ))}
              {updates.length === 0 && (
                <div className="text-xs text-muted-foreground">No updates yet.</div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IncidentsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminIncidents);
  const del = useServerFn(deleteIncident);
  const [statusFilter, setStatusFilter] = useState("");
  const [impactFilter, setImpactFilter] = useState("");

  const { data = [] } = useQuery<IncidentRow[]>({
    queryKey: ["admin-incidents"],
    queryFn: () => list({}) as Promise<IncidentRow[]>,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-incidents"] });
    qc.invalidateQueries({ queryKey: ["public-incidents"] });
  };

  async function doDelete(id: string) {
    try {
      await del({ data: { id } });
      toast.success("Incident deleted.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  const filtered = data.filter(
    (r) => (!statusFilter || r.status === statusFilter) && (!impactFilter || r.impact === impactFilter),
  );

  const columns: Column<IncidentRow>[] = [
    { key: "title", label: "Title", sortable: true, value: (r) => r.title },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => (
        <span
          className={
            r.status === "resolved"
              ? "text-emerald-500"
              : r.status === "monitoring"
                ? "text-sky-500"
                : "text-amber-500"
          }
        >
          {r.status}
        </span>
      ),
    },
    {
      key: "impact",
      label: "Impact",
      sortable: true,
      value: (r) => r.impact,
      cell: (r) => (
        <span className={r.impact === "critical" || r.impact === "major" ? "text-destructive" : ""}>
          {r.impact}
        </span>
      ),
    },
    {
      key: "affected_components",
      label: "Components",
      value: (r) => (r.affected_components ?? []).join(", "),
    },
    {
      key: "is_public",
      label: "Public",
      sortable: true,
      value: (r) => (r.is_public ? "yes" : "no"),
      cell: (r) => (r.is_public ? <span className="text-emerald-500">yes</span> : "no"),
    },
    {
      key: "started_at",
      label: "Started",
      sortable: true,
      value: (r) => r.started_at,
      cell: (r) => fmt(r.started_at),
    },
    {
      key: "resolved_at",
      label: "Resolved",
      sortable: true,
      value: (r) => r.resolved_at ?? "",
      cell: (r) => fmt(r.resolved_at),
    },
  ];

  return (
    <AdminDataTable<IncidentRow>
      title="Incidents"
      description="Status-page incidents with public timeline updates."
      rows={filtered}
      columns={columns}
      getRowId={(r) => r.id}
      searchKeys={["title", "summary"]}
      filters={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: "", label: "All" },
            ...INCIDENT_STATUSES.map((s) => ({ value: s, label: s })),
          ],
        },
        {
          key: "impact",
          label: "Impact",
          value: impactFilter,
          onChange: setImpactFilter,
          options: [
            { value: "", label: "Any" },
            ...INCIDENT_IMPACTS.map((s) => ({ value: s, label: s })),
          ],
        },
      ]}
      exportFilename="incidents"
      toolbarExtra={
        <IncidentEditor
          onSaved={invalidate}
          trigger={
            <Button size="sm" className="gap-1">
              <AlertTriangle className="size-3.5" /> New incident
            </Button>
          }
        />
      }
      rowActions={(r) => (
        <div className="flex items-center gap-1">
          <IncidentUpdateDialog
            incidentId={r.id}
            onSaved={invalidate}
            trigger={
              <Button variant="ghost" size="sm" className="gap-1">
                <MessageSquarePlus className="size-3.5" /> Update
              </Button>
            }
          />
          <IncidentEditor
            initial={r}
            onSaved={invalidate}
            trigger={
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            }
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="gap-1 text-destructive">
                <Trash2 className="size-3.5" /> Delete
              </Button>
            }
            title="Delete incident"
            description="Permanent. Timeline updates will cascade."
            confirmLabel="Delete"
            destructive
            onConfirm={() => doDelete(r.id)}
          />
        </div>
      )}
    />
  );
}


// ============================================================
// QUEUE MANAGER — job queue visibility, retries, DLQ
// ============================================================
const JOB_STATUSES: JobStatus[] = [
  "pending",
  "processing",
  "completed",
  "failed",
  "dlq",
  "cancelled",
];

function jobStatusTone(status: JobStatus): string {
  switch (status) {
    case "pending":
      return "text-muted-foreground";
    case "processing":
      return "text-sky-500";
    case "completed":
      return "text-emerald-500";
    case "failed":
      return "text-amber-500";
    case "dlq":
      return "text-destructive";
    case "cancelled":
      return "text-muted-foreground";
  }
}

export function QueueManagerPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminJobs);
  const statsFn = useServerFn(getQueueStats);
  const retryFn = useServerFn(retryJob);
  const dlqFn = useServerFn(moveJobToDlq);
  const cancelFn = useServerFn(cancelJob);
  const deleteFn = useServerFn(deleteJob);
  const bulkRetryFn = useServerFn(bulkRetryFailed);
  const purgeFn = useServerFn(purgeDlq);

  const [queueFilter, setQueueFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");

  const { data: jobs = [] } = useQuery<JobRow[]>({
    queryKey: ["admin-jobs", queueFilter, statusFilter],
    queryFn: () =>
      listFn({
        data: {
          queue: queueFilter || undefined,
          status: statusFilter || undefined,
          limit: 500,
        },
      }) as Promise<JobRow[]>,
    refetchInterval: 15000,
  });

  const { data: stats = [] } = useQuery<QueueStat[]>({
    queryKey: ["admin-queue-stats"],
    queryFn: () => statsFn({}) as Promise<QueueStat[]>,
    refetchInterval: 15000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-jobs"] });
    qc.invalidateQueries({ queryKey: ["admin-queue-stats"] });
  };

  const queueOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of stats) set.add(s.queue);
    for (const j of jobs) set.add(j.queue);
    return Array.from(set).sort();
  }, [stats, jobs]);

  // Aggregate stats per queue
  const perQueue = useMemo(() => {
    const map = new Map<string, Record<JobStatus, number>>();
    for (const s of stats) {
      const row =
        map.get(s.queue) ??
        ({
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          dlq: 0,
          cancelled: 0,
        } as Record<JobStatus, number>);
      row[s.status] = s.count;
      map.set(s.queue, row);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [stats]);

  async function doRetry(id: string) {
    try {
      await retryFn({ data: { id } });
      toast.success("Job requeued.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed.");
    }
  }
  async function doDlq(id: string) {
    try {
      await dlqFn({ data: { id } });
      toast.success("Moved to DLQ.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    }
  }
  async function doCancel(id: string) {
    try {
      await cancelFn({ data: { id } });
      toast.success("Job cancelled.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed.");
    }
  }
  async function doDelete(id: string) {
    try {
      await deleteFn({ data: { id } });
      toast.success("Job deleted.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }
  async function doBulkRetry() {
    try {
      const res = await bulkRetryFn({ data: { queue: queueFilter || undefined } });
      toast.success(`Requeued ${res.count} failed jobs.`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk retry failed.");
    }
  }
  async function doPurge() {
    try {
      const res = await purgeFn({ data: { queue: queueFilter || undefined } });
      toast.success(`Purged ${res.count} DLQ jobs.`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purge failed.");
    }
  }

  const columns: Column<JobRow>[] = [
    {
      key: "queue",
      label: "Queue",
      sortable: true,
      value: (r) => r.queue,
      cell: (r) => (
        <div>
          <div className="font-medium text-foreground">{r.queue}</div>
          <div className="text-xs text-muted-foreground">{r.job_type}</div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      cell: (r) => <span className={jobStatusTone(r.status)}>{r.status}</span>,
    },
    {
      key: "attempts",
      label: "Attempts",
      align: "right",
      sortable: true,
      value: (r) => r.attempts,
      cell: (r) => (
        <span className={r.attempts >= r.max_attempts ? "text-destructive" : ""}>
          {r.attempts}/{r.max_attempts}
        </span>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      align: "right",
      sortable: true,
      value: (r) => r.priority,
    },
    {
      key: "workspace_id",
      label: "Workspace",
      value: (r) => r.workspace_id ?? "",
      cell: (r) =>
        r.workspace_id ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {r.workspace_id.slice(0, 8)}…
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "scheduled_for",
      label: "Scheduled",
      sortable: true,
      value: (r) => r.scheduled_for,
      cell: (r) => fmt(r.scheduled_for),
    },
    {
      key: "last_error",
      label: "Last error",
      value: (r) => r.last_error ?? "",
      cell: (r) =>
        r.last_error ? (
          <span
            className="block max-w-[240px] truncate text-xs text-destructive"
            title={r.last_error}
          >
            {r.last_error}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      value: (r) => r.created_at,
      cell: (r) => fmt(r.created_at),
    },
  ];

  return (
    <section className="space-y-6">
      {/* Stats grid */}
      {perQueue.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {perQueue.map(([queue, counts]) => {
            const total = JOB_STATUSES.reduce((s, k) => s + (counts[k] ?? 0), 0);
            return (
              <div key={queue} className="rounded-xl border border-border/60 bg-card/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-foreground">{queue}</span>
                  <span className="text-xs text-muted-foreground">{total} jobs</span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  {JOB_STATUSES.map((s) => (
                    <div key={s} className="flex items-center justify-between gap-1">
                      <dt className={`capitalize ${jobStatusTone(s)}`}>{s}</dt>
                      <dd className="font-mono">{counts[s] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      <AdminDataTable<JobRow>
        title="Job Queue"
        description="Background jobs across every queue. Retry orchestration and Dead Letter Queue management."
        rows={jobs}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={["queue", "job_type", "workspace_id", "last_error"]}
        filters={[
          {
            key: "queue",
            label: "Queue",
            value: queueFilter,
            onChange: setQueueFilter,
            options: [
              { value: "", label: "All queues" },
              ...queueOptions.map((q) => ({ value: q, label: q })),
            ],
          },
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as JobStatus | ""),
            options: [
              { value: "", label: "All" },
              ...JOB_STATUSES.map((s) => ({ value: s, label: s })),
            ],
          },
        ]}
        exportFilename="job-queue"
        toolbarExtra={
          <div className="flex items-center gap-2">
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="gap-1">
                  <RefreshCw className="size-3.5" /> Retry all failed
                </Button>
              }
              title="Retry all failed jobs"
              description={
                queueFilter
                  ? `Every failed job in the "${queueFilter}" queue will be requeued.`
                  : "Every failed job across all queues will be requeued."
              }
              confirmLabel="Retry all"
              onConfirm={doBulkRetry}
            />
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="gap-1 text-destructive">
                  <Trash2 className="size-3.5" /> Purge DLQ
                </Button>
              }
              title="Purge Dead Letter Queue"
              description={
                queueFilter
                  ? `Permanently delete every DLQ job in the "${queueFilter}" queue. Cannot be undone.`
                  : "Permanently delete every DLQ job across all queues. Cannot be undone."
              }
              confirmLabel="Purge"
              destructive
              onConfirm={doPurge}
            />
          </div>
        }
        rowActions={(r) => (
          <div className="flex items-center gap-1">
            {(r.status === "failed" || r.status === "dlq" || r.status === "cancelled") && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => doRetry(r.id)}
              >
                <Play className="size-3.5" /> Retry
              </Button>
            )}
            {(r.status === "pending" || r.status === "processing" || r.status === "failed") && (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1">
                    <XCircle className="size-3.5" /> Cancel
                  </Button>
                }
                title="Cancel job"
                description="The job will stop being retried."
                confirmLabel="Cancel job"
                onConfirm={() => doCancel(r.id)}
              />
            )}
            {r.status !== "dlq" && r.status !== "completed" && (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1 text-amber-500">
                    <AlertOctagon className="size-3.5" /> DLQ
                  </Button>
                }
                title="Move to Dead Letter Queue"
                description="The job will be quarantined for manual review."
                confirmLabel="Move to DLQ"
                onConfirm={() => doDlq(r.id)}
              />
            )}
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1 text-destructive">
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              }
              title="Delete job"
              description="Permanent. Cannot be recovered."
              confirmLabel="Delete"
              destructive
              onConfirm={() => doDelete(r.id)}
            />
          </div>
        )}
      />
    </section>
  );
}
