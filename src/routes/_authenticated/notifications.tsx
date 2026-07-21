import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bell, CheckCheck, CircleAlert, Info, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ALERT_CATEGORIES,
  ALERT_SEVERITIES,
  bulkDismissAlerts,
  getNotificationPreferences,
  listAlerts,
  updateAlertStatus,
  upsertNotificationPreference,
  type AlertCategory,
  type AlertSeverity,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [{ title: "Notifications — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
});

const CATEGORY_LABEL: Record<AlertCategory, string> = {
  recovery_failure: "Failed recovery attempts",
  webhook_issue: "Webhook issues",
  activation_status: "Activation status changes",
  integration_error: "Integration errors",
  system: "System notices",
};

const CATEGORY_DESC: Record<AlertCategory, string> = {
  recovery_failure: "A recovery attempt failed to deliver on any channel.",
  webhook_issue: "Incoming provider webhooks returned an error or non-2xx status.",
  activation_status: "Recovery engine or workspace status is turned on/off or changed.",
  integration_error: "A connected provider (store, payment, email, SMS) reported an error.",
  system: "General product notices and maintenance updates.",
};

function severityIcon(sev: AlertSeverity) {
  if (sev === "critical") return <ShieldAlert className="h-4 w-4 text-destructive" />;
  if (sev === "warning") return <CircleAlert className="h-4 w-4 text-amber-500" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

function severityBadge(sev: AlertSeverity) {
  const variant = sev === "critical" ? "destructive" : sev === "warning" ? "secondary" : "outline";
  return (
    <Badge variant={variant as "destructive" | "secondary" | "outline"} className="capitalize">
      {sev}
    </Badge>
  );
}

function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"open" | "acknowledged" | "dismissed" | "all">(
    "open",
  );

  const workspacesQ = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const activeWorkspace =
    workspacesQ.data?.find((w) => w.status === "active" || w.status === "trial") ??
    workspacesQ.data?.[0] ??
    null;

  const list = useServerFn(listAlerts);
  const updateStatus = useServerFn(updateAlertStatus);
  const bulkDismiss = useServerFn(bulkDismissAlerts);
  const getPrefs = useServerFn(getNotificationPreferences);
  const savePref = useServerFn(upsertNotificationPreference);

  const alertsQ = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["alerts", activeWorkspace?.id, statusFilter],
    queryFn: () =>
      list({
        data: {
          workspaceId: activeWorkspace!.id,
          status: statusFilter === "all" ? undefined : statusFilter,
          limit: 100,
        },
      }),
    refetchInterval: 20000,
  });

  const prefsQ = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["notification-prefs", activeWorkspace?.id],
    queryFn: () => getPrefs({ data: { workspaceId: activeWorkspace!.id } }),
  });

  const updateStatusM = useMutation({
    mutationFn: (v: { alertId: string; status: "acknowledged" | "dismissed" | "open" }) =>
      updateStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const bulkM = useMutation({
    mutationFn: () => bulkDismiss({ data: { workspaceId: activeWorkspace!.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("All open alerts dismissed");
    },
  });

  const prefM = useMutation({
    mutationFn: (v: {
      category: AlertCategory;
      in_app: boolean;
      email: boolean;
      min_severity: AlertSeverity;
    }) => savePref({ data: { ...v, workspaceId: activeWorkspace!.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      toast.success("Preferences saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const alerts = alertsQ.data?.alerts ?? [];
  const openCount = alertsQ.data?.openCount ?? 0;

  const prefsByCat = useMemo(() => {
    const m = new Map<
      AlertCategory,
      { in_app: boolean; email: boolean; min_severity: AlertSeverity }
    >();
    (prefsQ.data ?? []).forEach((p) =>
      m.set(p.category as AlertCategory, {
        in_app: p.in_app,
        email: p.email,
        min_severity: p.min_severity as AlertSeverity,
      }),
    );
    return m;
  }, [prefsQ.data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Notifications</h1>
              {openCount > 0 && <Badge variant="destructive">{openCount} open</Badge>}
            </div>
          </div>
          <Link to="/app" className="text-sm text-muted-foreground hover:underline">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox">Alerts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Show</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={openCount === 0 || bulkM.isPending}
                onClick={() => bulkM.mutate()}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Dismiss all open
              </Button>
            </div>

            {alertsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading alerts…</p>
            ) : alerts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  You're all caught up. No {statusFilter === "all" ? "" : statusFilter} alerts.
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Card>
                      <CardContent className="flex items-start justify-between gap-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{severityIcon(a.severity as AlertSeverity)}</div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{a.title}</p>
                              {severityBadge(a.severity as AlertSeverity)}
                              <Badge variant="outline" className="text-xs">
                                {CATEGORY_LABEL[a.category as AlertCategory] ?? a.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {a.status}
                              </Badge>
                            </div>
                            {a.message && (
                              <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(a.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {a.status === "open" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                updateStatusM.mutate({ alertId: a.id, status: "acknowledged" })
                              }
                            >
                              Acknowledge
                            </Button>
                          )}
                          {a.status !== "dismissed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateStatusM.mutate({ alertId: a.id, status: "dismissed" })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Notification preferences</CardTitle>
                <CardDescription>
                  Choose which alerts you receive in-app and via email for this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {ALERT_CATEGORIES.map((cat) => {
                  const p =
                    prefsByCat.get(cat) ??
                    ({ in_app: true, email: true, min_severity: "warning" } as const);
                  return (
                    <div
                      key={cat}
                      className="flex flex-col gap-3 border-b pb-4 last:border-0 last:pb-0 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{CATEGORY_LABEL[cat]}</p>
                        <p className="text-sm text-muted-foreground">{CATEGORY_DESC[cat]}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`inapp-${cat}`}
                            checked={p.in_app}
                            onCheckedChange={(v) =>
                              prefM.mutate({
                                category: cat,
                                in_app: v,
                                email: p.email,
                                min_severity: p.min_severity,
                              })
                            }
                          />
                          <Label htmlFor={`inapp-${cat}`} className="text-sm">
                            In-app
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`email-${cat}`}
                            checked={p.email}
                            onCheckedChange={(v) =>
                              prefM.mutate({
                                category: cat,
                                in_app: p.in_app,
                                email: v,
                                min_severity: p.min_severity,
                              })
                            }
                          />
                          <Label htmlFor={`email-${cat}`} className="text-sm">
                            Email
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">Min severity</Label>
                          <Select
                            value={p.min_severity}
                            onValueChange={(v) =>
                              prefM.mutate({
                                category: cat,
                                in_app: p.in_app,
                                email: p.email,
                                min_severity: v as AlertSeverity,
                              })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALERT_SEVERITIES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  Email delivery uses your workspace's configured sender. Terminal delivery events
                  (bounces, complaints, unsubscribes) are still enforced by the platform.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
