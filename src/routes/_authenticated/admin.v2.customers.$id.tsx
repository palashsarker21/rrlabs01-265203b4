import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ManageDropdown } from "@/components/admin/v2/manage-dropdown";
import { getCustomerDetail } from "@/lib/admin/customers.functions";

export const Route = createFileRoute("/_authenticated/admin/v2/customers/$id")({
  component: CustomerDetail,
  head: () => ({
    meta: [
      { title: "Customer detail — Platform Control Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCustomerDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => fn({ data: { workspaceId: id } }),
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (error || !data)
    return (
      <div className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load customer."}
      </div>
    );

  const ws = data.workspace;
  const row = {
    workspace_id: ws.id,
    workspace_name: ws.name,
    status: ws.status,
    recovery_engine_enabled: ws.recovery_engine_enabled,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link to="/admin/v2/customers">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to directory
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Building2 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
              <p className="text-sm text-muted-foreground">
                {ws.slug} · {ws.id}
              </p>
            </div>
          </div>
          <ManageDropdown row={row} />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Meta label="Status" value={ws.status} />
        <Meta label="Engine" value={ws.recovery_engine_enabled ? "On" : "Off"} />
        <Meta label="Members" value={String(data.members.length)} />
        <Meta label="Events" value={String(data.eventsCount)} />
        <Meta
          label="Plan"
          value={ws.plan_id ?? "—"}
        />
        <Meta
          label="Subscription"
          value={ws.subscription_status ?? "—"}
        />
        <Meta
          label="Trial ends"
          value={ws.trial_ends_at ? new Date(ws.trial_ends_at).toLocaleString() : "—"}
        />
        <Meta
          label="Created"
          value={new Date(ws.created_at).toLocaleDateString()}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Panel title="Members">
          {data.members.length === 0 ? (
            <Empty label="No members" />
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {data.members.map((m) => (
                <li key={`${m.user_id}-${m.role}`} className="flex justify-between py-2">
                  <span className="truncate font-mono text-xs">{m.user_id}</span>
                  <span className="text-muted-foreground">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Integrations">
          {data.integrations.length === 0 ? (
            <Empty label="No integrations" />
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {data.integrations.map((i) => {
                const active = i.status === "connected" || i.status === "active";
                return (
                  <li key={i.id} className="flex justify-between py-2">
                    <span className="capitalize">{i.provider}</span>
                    <span
                      className={`text-xs ${active ? "text-emerald-600" : "text-muted-foreground"}`}
                    >
                      {i.status}
                      {i.health ? ` · ${i.health}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Subscriptions" className="md:col-span-2">
          {data.subscriptions.length === 0 ? (
            <Empty label="No subscriptions" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1 text-left">Plan</th>
                  <th className="py-1 text-left">Status</th>
                  <th className="py-1 text-left">Provider</th>
                  <th className="py-1 text-left">Period</th>
                </tr>
              </thead>
              <tbody>
                {data.subscriptions.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="py-1.5">{s.plan_id ?? "—"}</td>
                    <td className="py-1.5">
                      {s.status ?? "—"}
                      {s.cancelled_at ? " (cancelled)" : ""}
                    </td>
                    <td className="py-1.5">{s.ls_subscription_id ? "Lemon Squeezy" : "—"}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {s.current_period_start
                        ? `${new Date(s.current_period_start).toLocaleDateString()} — ${
                            s.current_period_end
                              ? new Date(s.current_period_end).toLocaleDateString()
                              : "—"
                          }`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Recent activity" className="md:col-span-2">
          {data.audit.length === 0 ? (
            <Empty label="No audit entries" />
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {data.audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{a.action}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {a.actor_email ?? "system"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border/60 bg-card/40 ${className ?? ""}`}>
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{label}</p>;
}
