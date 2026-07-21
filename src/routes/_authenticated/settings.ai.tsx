import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Coins, Database, DollarSign, Loader2, Save, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { listMyWorkspaces } from "@/lib/team.functions";
import {
  getOrgAiSettings,
  listAvailableAiModels,
  updateOrgAiSettings,
  type OrgAiSettings,
} from "@/lib/ai/org-settings.functions";

export const Route = createFileRoute("/_authenticated/settings/ai")({
  component: OrgAiSettingsPage,
  head: () => ({
    meta: [{ title: "AI Settings — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
});

const AUTO_MODEL = "__auto__";

function OrgAiSettingsPage() {
  const qc = useQueryClient();
  const workspacesFn = useServerFn(listMyWorkspaces);
  const getFn = useServerFn(getOrgAiSettings);
  const modelsFn = useServerFn(listAvailableAiModels);
  const updateFn = useServerFn(updateOrgAiSettings);

  const { data: workspaces } = useQuery({
    queryKey: ["team-workspaces"],
    queryFn: () => workspacesFn(),
  });
  const [workspaceId, setWorkspaceId] = useState<string>("");
  useEffect(() => {
    if (!workspaceId && workspaces && workspaces.length > 0) {
      setWorkspaceId(workspaces[0]!.id);
    }
  }, [workspaces, workspaceId]);

  const { data: models } = useQuery({
    queryKey: ["ai-models-available"],
    queryFn: () => modelsFn(),
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["org-ai-settings", workspaceId],
    queryFn: () => getFn({ data: { workspaceId } }),
    enabled: !!workspaceId,
  });

  const [form, setForm] = useState<OrgAiSettings | null>(null);
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No settings loaded");
      return updateFn({
        data: {
          workspaceId,
          ai_enabled: form.ai_enabled,
          cache_enabled: form.cache_enabled,
          fallback_enabled: form.fallback_enabled,
          premium_enabled: form.premium_enabled,
          monthly_budget_usd: form.monthly_budget_usd,
          monthly_token_limit: form.monthly_token_limit,
          daily_budget_usd: form.daily_budget_usd,
          budget_alert_threshold: form.budget_alert_threshold,
          default_model: form.default_model,
          custom_system_prompt: form.custom_system_prompt,
        },
      });
    },
    onSuccess: (row) => {
      toast.success("AI settings saved");
      qc.setQueryData(["org-ai-settings", workspaceId], row);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patch<K extends keyof OrgAiSettings>(k: K, v: OrgAiSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  const canRender = !!workspaceId && !!form;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure AI behaviour, model preferences, and budget guardrails for this workspace.
          </p>
        </div>
        {workspaces && workspaces.length > 1 && (
          <div className="w-full max-w-xs">
            <Label className="text-xs">Workspace</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!canRender || isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Core toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" /> Core AI behaviour
              </CardTitle>
              <CardDescription>Master switches for AI features in this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                title="AI Enabled"
                description="Turn off to block all AI calls originating from this workspace."
                checked={form!.ai_enabled}
                onChange={(v) => patch("ai_enabled", v)}
              />
              <ToggleRow
                title="Cache Enabled"
                description="Reuse recent responses for identical prompts to reduce cost and latency."
                checked={form!.cache_enabled}
                onChange={(v) => patch("cache_enabled", v)}
              />
              <ToggleRow
                title="Fallback Enabled"
                description="Automatically retry with the next model if the primary fails."
                checked={form!.fallback_enabled}
                onChange={(v) => patch("fallback_enabled", v)}
              />
              <ToggleRow
                title="Premium Models Enabled"
                description="Allow premium-tier models (higher cost, best quality) for supported tasks."
                checked={form!.premium_enabled}
                onChange={(v) => patch("premium_enabled", v)}
              />
            </CardContent>
          </Card>

          {/* Default model */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" /> Default model
              </CardTitle>
              <CardDescription>
                Override the routed default model for this workspace. Leave on <em>Auto</em> to let the router pick.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={form!.default_model ?? AUTO_MODEL}
                onValueChange={(v) => patch("default_model", v === AUTO_MODEL ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_MODEL}>Auto (router default)</SelectItem>
                  {(models ?? []).map((m) => (
                    <SelectItem key={m.model_id} value={m.model_id}>
                      <span className="font-mono text-xs">{m.model_id}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.provider}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Budget */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" /> Budget & limits
              </CardTitle>
              <CardDescription>
                Set spend guardrails. When usage crosses the alert threshold, admins are notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Monthly budget (USD)"
                icon={<Coins className="h-3.5 w-3.5" />}
                value={form!.monthly_budget_usd}
                placeholder="Unlimited"
                onChange={(v) => patch("monthly_budget_usd", v)}
              />
              <NumberField
                label="Daily budget (USD)"
                icon={<Coins className="h-3.5 w-3.5" />}
                value={form!.daily_budget_usd}
                placeholder="Unlimited"
                onChange={(v) => patch("daily_budget_usd", v)}
              />
              <NumberField
                label="Monthly token limit"
                icon={<Zap className="h-3.5 w-3.5" />}
                value={form!.monthly_token_limit}
                placeholder="Unlimited"
                integer
                onChange={(v) => patch("monthly_token_limit", v)}
              />
              <div className="sm:col-span-2">
                <Label className="mb-2 flex items-center justify-between text-xs">
                  <span>Alert threshold</span>
                  <span className="font-mono text-muted-foreground">
                    {Math.round(form!.budget_alert_threshold * 100)}%
                  </span>
                </Label>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={[form!.budget_alert_threshold]}
                  onValueChange={([v]) => patch("budget_alert_threshold", v ?? 0.8)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Fires an alert when spend reaches this fraction of the monthly budget.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Prompt override */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" /> Custom system prompt
              </CardTitle>
              <CardDescription>
                Prepended to system messages for all tasks in this workspace. Leave empty to use the router default.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={6}
                placeholder="e.g. Always reply in the workspace's brand voice. Never mention competitors."
                value={form!.custom_system_prompt ?? ""}
                onChange={(e) =>
                  patch("custom_system_prompt", e.target.value.length ? e.target.value : null)
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {(form!.custom_system_prompt ?? "").length} / 8000 characters
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleRow(props: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-lg border p-3">
      <div>
        <div className="text-sm font-medium">{props.title}</div>
        <p className="text-xs text-muted-foreground">{props.description}</p>
      </div>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  integer?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 flex items-center gap-1.5 text-xs">
        {props.icon}
        {props.label}
      </Label>
      <Input
        type="number"
        inputMode={props.integer ? "numeric" : "decimal"}
        min={0}
        step={props.integer ? 1 : 0.01}
        value={props.value ?? ""}
        placeholder={props.placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return props.onChange(null);
          const n = props.integer ? parseInt(raw, 10) : parseFloat(raw);
          props.onChange(Number.isFinite(n) && n >= 0 ? n : null);
        }}
      />
    </div>
  );
}
