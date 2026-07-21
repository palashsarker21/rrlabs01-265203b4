import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  Database,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAiAnalytics } from "@/lib/ai/analytics.functions";

export const Route = createFileRoute("/_authenticated/platform/ai/analytics")({
  component: AiAnalyticsPage,
  head: () => ({
    meta: [{ title: "AI Analytics — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
});

const RANGES = [
  { key: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", label: "Last 90 days", ms: 90 * 24 * 60 * 60 * 1000 },
] as const;

const ANY = "__any__";

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
function fmtUSD(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function AiAnalyticsPage() {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("7d");
  const [provider, setProvider] = useState<string>(ANY);
  const [model, setModel] = useState<string>(ANY);
  const [task, setTask] = useState<string>(ANY);
  const [workspaceId, setWorkspaceId] = useState("");

  const { from, to } = useMemo(() => {
    const now = Date.now();
    const range = RANGES.find((r) => r.key === rangeKey)!;
    return { from: new Date(now - range.ms).toISOString(), to: new Date(now).toISOString() };
  }, [rangeKey]);

  const fetchAnalytics = useServerFn(getAiAnalytics);
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["ai-analytics", from, to, provider, model, task, workspaceId],
    queryFn: () =>
      fetchAnalytics({
        data: {
          from,
          to,
          provider: provider === ANY ? undefined : provider,
          model: model === ANY ? undefined : model,
          task: task === ANY ? undefined : task,
          workspaceId: workspaceId.trim() || undefined,
        },
      }),
  });

  const totals = data?.totals;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Requests, success, retries, latency, tokens, cost, and cache performance across
            providers and models.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-xs">Range</Label>
              <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as typeof rangeKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All providers</SelectItem>
                  {(data?.facets.providers ?? []).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All models</SelectItem>
                  {(data?.facets.models ?? []).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Task</Label>
              <Select value={task} onValueChange={setTask}>
                <SelectTrigger>
                  <SelectValue placeholder="All tasks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All tasks</SelectItem>
                  {(data?.facets.tasks ?? []).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Workspace ID (optional)</Label>
              <Input
                placeholder="uuid"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading || !totals ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading analytics…
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            <Kpi
              icon={<Activity className="h-4 w-4" />}
              label="Requests"
              value={fmtNum(totals.requests)}
            />
            <Kpi
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Success rate"
              value={fmtPct(totals.success_rate)}
              sub={`${fmtNum(totals.success)} ok / ${fmtNum(totals.failure)} failed`}
            />
            <Kpi
              icon={<RefreshCw className="h-4 w-4" />}
              label="Retries / fallback"
              value={`${fmtNum(totals.retries)} / ${fmtNum(totals.fallback)}`}
            />
            <Kpi
              icon={<Clock className="h-4 w-4" />}
              label="Avg / p95 latency"
              value={`${fmtNum(totals.avg_latency_ms)} ms`}
              sub={`p95 ${fmtNum(totals.p95_latency_ms)} ms`}
            />
            <Kpi
              icon={<Zap className="h-4 w-4" />}
              label="Tokens (in / out)"
              value={`${fmtNum(totals.input_tokens)} / ${fmtNum(totals.output_tokens)}`}
            />
            <Kpi
              icon={<Coins className="h-4 w-4" />}
              label="Cost"
              value={fmtUSD(totals.cost_usd)}
              sub={`Cache hit ${fmtPct(totals.cache_hit_rate)}`}
            />
          </div>

          {/* Timeseries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requests over time</CardTitle>
              <CardDescription>Success vs failure vs cached hits.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    }
                    fontSize={11}
                  />
                  <YAxis fontSize={11} />
                  <Tooltip
                    labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="success"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="failure"
                    stackId="1"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="cached"
                    stackId="1"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Latency + Cost dual */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg latency</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      fontSize={11}
                    />
                    <YAxis fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avg_latency_ms"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost (USD)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      fontSize={11}
                    />
                    <YAxis fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar dataKey="cost_usd" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Provider breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By provider</CardTitle>
              <CardDescription>
                Volume, success rate, latency, and spend per provider.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Failure</TableHead>
                    <TableHead className="text-right">Avg latency</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byProvider.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.byProvider.map((p) => (
                      <TableRow key={p.provider}>
                        <TableCell>
                          <Badge variant="outline">{p.provider}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmtNum(p.requests)}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                          {fmtNum(p.success)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {fmtNum(p.failure)}
                        </TableCell>
                        <TableCell className="text-right">{fmtNum(p.avg_latency_ms)} ms</TableCell>
                        <TableCell className="text-right">{fmtUSD(p.cost_usd)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Model breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By model</CardTitle>
              <CardDescription>Token consumption and unit economics per model.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Success/Fail</TableHead>
                    <TableHead className="text-right">In tokens</TableHead>
                    <TableHead className="text-right">Out tokens</TableHead>
                    <TableHead className="text-right">Avg latency</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byModel.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.byModel.map((m) => (
                      <TableRow key={m.model}>
                        <TableCell className="font-mono text-xs">{m.model}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.provider}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmtNum(m.requests)}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {fmtNum(m.success)}
                          </span>
                          {" / "}
                          <span className="text-destructive">{fmtNum(m.failure)}</span>
                        </TableCell>
                        <TableCell className="text-right">{fmtNum(m.input_tokens)}</TableCell>
                        <TableCell className="text-right">{fmtNum(m.output_tokens)}</TableCell>
                        <TableCell className="text-right">{fmtNum(m.avg_latency_ms)} ms</TableCell>
                        <TableCell className="text-right">{fmtUSD(m.cost_usd)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Task + cache */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" /> By task & cache performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Cache hit rate</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byTask.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.byTask.map((t) => (
                      <TableRow key={t.task}>
                        <TableCell>
                          <Badge variant="secondary">{t.task}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmtNum(t.requests)}</TableCell>
                        <TableCell className="text-right">{fmtPct(t.cache_hit_rate)}</TableCell>
                        <TableCell className="text-right">{fmtUSD(t.cost_usd)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
