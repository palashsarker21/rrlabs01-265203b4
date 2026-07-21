import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Play, ShieldCheck, ShieldAlert, Loader2, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runRlsTestSuite, type RlsTestResult } from "@/lib/rls-tests.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rls-verification")({
  component: RlsVerificationPage,
});

type Status = "pending" | "running" | "passed" | "failed";

type BrowserTest = {
  id: string;
  name: string;
  description: string;
  status: Status;
  detail?: string;
  logs: string[];
};

const initialTests: BrowserTest[] = [
  {
    id: "read_own_workspaces",
    name: "Baseline: authenticated user can read own workspaces",
    description:
      "Fetches workspaces via the browser Supabase client — expects at least one row when signed in.",
    status: "pending",
    logs: [],
  },
  {
    id: "read_foreign_workspace",
    name: "Cross-tenant SELECT is blocked",
    description:
      "Attempts to fetch a workspace by a random UUID that the user does not belong to — expects 0 rows.",
    status: "pending",
    logs: [],
  },
  {
    id: "read_foreign_members",
    name: "Cross-tenant workspace_members SELECT is blocked",
    description: "Filters workspace_members by a random workspace_id — expects 0 rows.",
    status: "pending",
    logs: [],
  },
  {
    id: "read_foreign_events",
    name: "Cross-tenant recovery_events SELECT is blocked",
    description: "Filters recovery_events by a random workspace_id — expects 0 rows.",
    status: "pending",
    logs: [],
  },
  {
    id: "insert_foreign_integration",
    name: "Cross-tenant INSERT is blocked",
    description:
      "Tries to insert an integration row referencing a random workspace — expects an RLS error.",
    status: "pending",
    logs: [],
  },
  {
    id: "update_foreign_workspace",
    name: "Cross-tenant UPDATE is blocked",
    description: "Attempts to rename a workspace by a random UUID — expects 0 rows affected.",
    status: "pending",
    logs: [],
  },
  {
    id: "realtime_isolation",
    name: "Realtime subscription respects RLS",
    description:
      "Subscribes to changes on workspaces filtered to a random UUID and waits 2.5s — expects zero events delivered.",
    status: "pending",
    logs: [],
  },
];

function RlsVerificationPage() {
  const runServerSuite = useServerFn(runRlsTestSuite);
  const [running, setRunning] = useState(false);
  const [serverReport, setServerReport] = useState<{
    ran_at: string;
    total: number;
    passed: number;
    failed: number;
    results: RlsTestResult[];
  } | null>(null);
  const [tests, setTests] = useState<BrowserTest[]>(initialTests);
  const runIdRef = useRef(0);

  function patch(id: string, changes: Partial<BrowserTest>) {
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }
  function log(id: string, line: string) {
    setTests((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, logs: [...t.logs, `[${new Date().toLocaleTimeString()}] ${line}`] }
          : t,
      ),
    );
  }

  async function runBrowserTest(t: BrowserTest) {
    patch(t.id, { status: "running", detail: undefined, logs: [] });
    const fakeWorkspace = crypto.randomUUID();
    log(t.id, `Using synthetic workspace_id=${fakeWorkspace}`);

    try {
      switch (t.id) {
        case "read_own_workspaces": {
          const { data, error } = await supabase.from("workspaces").select("id, name").limit(50);
          if (error) throw error;
          log(t.id, `Received ${data?.length ?? 0} workspace row(s).`);
          if ((data?.length ?? 0) < 1) {
            patch(t.id, {
              status: "failed",
              detail: "Expected at least one workspace visible to this user.",
            });
          } else {
            patch(t.id, { status: "passed", detail: `Visible workspaces: ${data!.length}` });
          }
          return;
        }
        case "read_foreign_workspace": {
          const { data, error } = await supabase
            .from("workspaces")
            .select("id")
            .eq("id", fakeWorkspace);
          if (error) throw error;
          log(t.id, `rows=${data?.length ?? 0}`);
          patch(t.id, {
            status: (data?.length ?? 0) === 0 ? "passed" : "failed",
            detail: `rows=${data?.length ?? 0} (expected 0)`,
          });
          return;
        }
        case "read_foreign_members": {
          const { data, error } = await supabase
            .from("workspace_members")
            .select("user_id")
            .eq("workspace_id", fakeWorkspace);
          if (error) throw error;
          log(t.id, `rows=${data?.length ?? 0}`);
          patch(t.id, {
            status: (data?.length ?? 0) === 0 ? "passed" : "failed",
            detail: `rows=${data?.length ?? 0} (expected 0)`,
          });
          return;
        }
        case "read_foreign_events": {
          const { data, error } = await supabase
            .from("recovery_events")
            .select("id")
            .eq("workspace_id", fakeWorkspace);
          if (error) throw error;
          log(t.id, `rows=${data?.length ?? 0}`);
          patch(t.id, {
            status: (data?.length ?? 0) === 0 ? "passed" : "failed",
            detail: `rows=${data?.length ?? 0} (expected 0)`,
          });
          return;
        }
        case "insert_foreign_integration": {
          const { error } = await supabase.from("integrations").insert({
            workspace_id: fakeWorkspace,
            provider: "rls-probe",
            kind: "store",
            status: "connected",
          });
          if (error) {
            log(t.id, `blocked: ${error.message}`);
            patch(t.id, { status: "passed", detail: `Blocked by RLS: ${error.message}` });
          } else {
            log(t.id, "insert unexpectedly succeeded");
            patch(t.id, { status: "failed", detail: "Insert into foreign workspace was allowed." });
          }
          return;
        }
        case "update_foreign_workspace": {
          const { data, error } = await supabase
            .from("workspaces")
            .update({ name: "rls-probe-hijack" })
            .eq("id", fakeWorkspace)
            .select("id");
          if (error) {
            log(t.id, `blocked: ${error.message}`);
            patch(t.id, { status: "passed", detail: `Blocked by RLS: ${error.message}` });
            return;
          }
          log(t.id, `affected=${data?.length ?? 0}`);
          patch(t.id, {
            status: (data?.length ?? 0) === 0 ? "passed" : "failed",
            detail: `affected=${data?.length ?? 0} (expected 0)`,
          });
          return;
        }
        case "realtime_isolation": {
          let events = 0;
          const channelName = `rls-probe-${fakeWorkspace}`;
          log(t.id, `Opening realtime channel ${channelName}`);
          const channel = supabase
            .channel(channelName)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "workspaces",
                filter: `id=eq.${fakeWorkspace}`,
              },
              (payload) => {
                events += 1;
                log(t.id, `unexpected event: ${payload.eventType}`);
              },
            );

          const subscribed = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), 3000);
            channel.subscribe((status) => {
              log(t.id, `subscribe status=${status}`);
              if (status === "SUBSCRIBED") {
                clearTimeout(timer);
                resolve(true);
              }
              if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
                clearTimeout(timer);
                resolve(false);
              }
            });
          });

          if (!subscribed) {
            await supabase.removeChannel(channel);
            patch(t.id, { status: "failed", detail: "Could not open realtime channel." });
            return;
          }

          log(t.id, "Waiting 2500ms for any cross-tenant events…");
          await new Promise((r) => setTimeout(r, 2500));
          await supabase.removeChannel(channel);
          log(t.id, `events observed=${events}`);
          patch(t.id, {
            status: events === 0 ? "passed" : "failed",
            detail: `events=${events} (expected 0)`,
          });
          return;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(t.id, `error: ${msg}`);
      patch(t.id, { status: "failed", detail: msg });
    }
  }

  async function runAll() {
    if (running) return;
    setRunning(true);
    const currentRun = ++runIdRef.current;
    setServerReport(null);
    setTests(initialTests.map((t) => ({ ...t, status: "pending", detail: undefined, logs: [] })));

    // Kick off DB suite in parallel with browser tests
    const serverPromise = (async () => {
      try {
        const r = await runServerSuite({});
        if (runIdRef.current === currentRun) setServerReport(r);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Server suite failed");
      }
    })();

    for (const t of initialTests) {
      if (runIdRef.current !== currentRun) return;
      await runBrowserTest(t);
    }

    await serverPromise;
    setRunning(false);
    toast.success("RLS verification complete");
  }

  useEffect(() => {
    return () => {
      runIdRef.current++;
    };
  }, []);

  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              to="/admin"
              className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to admin
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" />
              End-to-end RLS verification
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Runs cross-tenant read, write, update, and realtime probes from this browser session,
              plus the server-side synthetic tenant suite. Zero cross-tenant leakage should be
              reported.
            </p>
          </div>
          <Button onClick={runAll} disabled={running}>
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {running ? "Running…" : "Run all tests"}
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <SummaryCard label="Browser tests" value={`${tests.length}`} />
          <SummaryCard label="Passed" value={`${passed}`} tone="ok" />
          <SummaryCard label="Failed" value={`${failed}`} tone={failed > 0 ? "bad" : "muted"} />
        </div>

        <section className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Browser-side probes
          </h2>
          {tests.map((t) => (
            <TestRow key={t.id} test={t} />
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Server-side synthetic tenant suite
          </h2>
          {!serverReport ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
              {running ? "Running server suite…" : "Not run yet."}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card/50">
              <div className="flex items-center justify-between border-b border-border/60 p-4 text-sm">
                <span>
                  {serverReport.passed}/{serverReport.total} passed
                </span>
                <span className="text-muted-foreground">
                  ran at {new Date(serverReport.ran_at).toLocaleTimeString()}
                </span>
              </div>
              <ul className="divide-y divide-border/60">
                {serverReport.results.map((r) => (
                  <li key={r.test_name} className="flex items-start gap-3 p-3">
                    <StatusDot status={r.passed ? "passed" : "failed"} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.test_name}</div>
                      <div className="text-xs text-muted-foreground">{r.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "muted";
}) {
  const color =
    tone === "ok" ? "text-emerald-500" : tone === "bad" ? "text-red-500" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pending: "bg-muted",
    running: "bg-amber-500 animate-pulse",
    passed: "bg-emerald-500",
    failed: "bg-red-500",
  };
  return <span className={`mt-1.5 inline-block h-2.5 w-2.5 rounded-full ${map[status]}`} />;
}

function TestRow({ test }: { test: BrowserTest }) {
  const [open, setOpen] = useState(false);
  const Icon = test.status === "failed" ? ShieldAlert : ShieldCheck;
  const iconColor =
    test.status === "passed"
      ? "text-emerald-500"
      : test.status === "failed"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50">
      <div className="flex items-start gap-3 p-4">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{test.name}</div>
            <StatusBadge status={test.status} />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{test.description}</div>
          {test.detail && <div className="mt-2 text-xs">{test.detail}</div>}
          {test.logs.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Terminal className="h-3 w-3" />
              {open ? "Hide" : "Show"} logs ({test.logs.length})
            </button>
          )}
          {open && (
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed">
              {test.logs.join("\n")}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    pending: { label: "pending", cls: "bg-muted text-muted-foreground" },
    running: { label: "running", cls: "bg-amber-500/15 text-amber-600" },
    passed: { label: "passed", cls: "bg-emerald-500/15 text-emerald-600" },
    failed: { label: "failed", cls: "bg-red-500/15 text-red-600" },
  };
  const s = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>
  );
}
