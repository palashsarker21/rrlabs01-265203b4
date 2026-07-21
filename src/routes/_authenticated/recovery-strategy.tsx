import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  Sparkles,
  Shield,
  Zap,
  Clock,
  Percent,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  MessageSquare,
  Mail,
  Smartphone,
  Bell,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import {
  getRecoveryStrategy,
  updateRecoveryStrategy,
  type RecoveryStrategy,
} from "@/lib/recovery-strategy/strategy.functions";

export const Route = createFileRoute("/_authenticated/recovery-strategy")({
  head: () => ({
    meta: [
      { title: "AI Recovery Strategy · RRLabs" },
      {
        name: "description",
        content:
          "Configure your AI recovery preferences. RRLabs autonomously generates every recovery message, chooses the best channel, and decides the next action for every failed payment.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoveryStrategyPage,
});

type Channel = RecoveryStrategy["preferred_channels"][number];

const CHANNEL_META: Record<Channel, { label: string; icon: typeof Mail; desc: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageSquare, desc: "Fastest response rates for most regions." },
  email: { label: "Email", icon: Mail, desc: "Universal reach, rich formatting." },
  sms: { label: "SMS", icon: Smartphone, desc: "High deliverability, short-form nudges." },
  push: { label: "Push Notification", icon: Bell, desc: "In-app / mobile push where available." },
};

const BRAND_VOICES: Array<{ id: RecoveryStrategy["brand_voice"]; label: string; desc: string }> = [
  { id: "professional", label: "Professional", desc: "Clear, respectful, business-standard tone." },
  { id: "friendly", label: "Friendly", desc: "Warm and conversational, first-name basis." },
  { id: "premium", label: "Premium", desc: "Refined, concise, confidence-building." },
  { id: "luxury", label: "Luxury", desc: "Elevated language for high-value subscriptions." },
  { id: "custom", label: "Custom", desc: "Describe your voice — AI will match it." },
];

const AUTOMATION_MODES: Array<{
  id: RecoveryStrategy["automation_mode"];
  label: string;
  desc: string;
  recommended?: boolean;
}> = [
  {
    id: "autopilot",
    label: "Full Autopilot",
    desc: "AI decides, generates, and sends every message automatically. Recommended.",
    recommended: true,
  },
  {
    id: "approval",
    label: "Approval Required",
    desc: "AI drafts every message; you approve before it sends.",
  },
  {
    id: "manual",
    label: "Manual",
    desc: "AI suggests only. Your team sends everything manually.",
  },
];

function RecoveryStrategyPage() {
  const access = useAccess();
  const workspaceId = access.ctx.workspaceId ?? "";
  const qc = useQueryClient();

  const getFn = useServerFn(getRecoveryStrategy);
  const updateFn = useServerFn(updateRecoveryStrategy);

  const { data, isLoading } = useQuery({
    queryKey: ["recovery-strategy", workspaceId],
    queryFn: () => getFn({ data: { workspaceId } }),
    enabled: !!workspaceId,
  });

  const [form, setForm] = useState<RecoveryStrategy | null>(null);
  useEffect(() => {
    if (data) setForm(data as RecoveryStrategy);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No form loaded");
      return updateFn({ data: form });
    },
    onSuccess: () => {
      toast.success("AI recovery strategy updated");
      qc.invalidateQueries({ queryKey: ["recovery-strategy", workspaceId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const setField = <K extends keyof RecoveryStrategy>(k: K, v: RecoveryStrategy[K]) => {
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev));
  };

  const moveChannel = (idx: number, dir: -1 | 1) => {
    if (!form) return;
    const next = [...form.preferred_channels];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setField("preferred_channels", next);
  };

  const retrySummary = useMemo(() => {
    if (!form) return "";
    return form.retry_schedule_minutes
      .map((m) => (m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`))
      .join(" → ");
  }, [form]);

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-muted-foreground">
        Select a workspace to configure AI recovery strategy.
      </div>
    );
  }
  if (isLoading || !form) {
    return (
      <div className="mx-auto max-w-3xl p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading strategy…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" /> Autonomous Recovery Engine
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">AI Recovery Strategy</h1>
        <p className="text-muted-foreground max-w-3xl">
          RRLabs is an autonomous AI-powered payment recovery system. For every failed payment, our AI
          analyzes the failure reason, customer history, subscription value, language, timezone, and
          channel availability — then generates a personalized message, picks the best channel, and
          schedules delivery automatically. You set the business preferences below; the AI handles the rest.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary" className="gap-1"><Bot className="h-3 w-3" /> AI-generated messages</Badge>
          <Badge variant="secondary" className="gap-1"><Zap className="h-3 w-3" /> Real-time channel selection</Badge>
          <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Compliance-aware</Badge>
        </div>
      </header>

      {/* Brand Voice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Brand Voice</CardTitle>
          <CardDescription>
            The AI matches this voice for every message it writes. No templates — every message is generated fresh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            {BRAND_VOICES.map((v) => {
              const active = form.brand_voice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setField("brand_voice", v.id)}
                  className={`text-left rounded-lg border p-3 transition ${
                    active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{v.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{v.desc}</p>
                </button>
              );
            })}
          </div>
          {form.brand_voice === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom-voice">Custom voice description</Label>
              <Textarea
                id="custom-voice"
                rows={3}
                placeholder="e.g. Direct but warm, no jargon, always sign off with the founder's first name."
                value={form.brand_voice_custom ?? ""}
                onChange={(e) => setField("brand_voice_custom", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The AI reads this description before generating each message.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automation Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> AI Automation Mode</CardTitle>
          <CardDescription>How much authority the AI has when a payment fails.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {AUTOMATION_MODES.map((m) => {
            const active = form.automation_mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setField("automation_mode", m.id)}
                className={`text-left rounded-lg border p-4 transition ${
                  active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{m.label}</span>
                  {m.recommended && <Badge variant="secondary" className="text-[10px]">Recommended</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                {active && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Recovery Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Recovery Policy</CardTitle>
          <CardDescription>
            Guardrails the AI respects on every attempt. It never sends outside these rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Maximum retry attempts</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[form.max_retries]}
                min={1}
                max={8}
                step={1}
                onValueChange={([v]) => setField("max_retries", v!)}
                className="flex-1"
              />
              <span className="w-8 text-right font-mono">{form.max_retries}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              AI stops immediately when the payment is recovered.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Percent className="h-3.5 w-3.5" /> Maximum discount AI may offer</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[form.max_discount_percent]}
                min={0}
                max={50}
                step={5}
                onValueChange={([v]) => setField("max_discount_percent", v!)}
                className="flex-1"
              />
              <span className="w-12 text-right font-mono">{form.max_discount_percent}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              AI applies a discount only when recovery probability drops below threshold.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Quiet hours (24h, workspace timezone)</Label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">From</span>
              <Input
                type="number"
                min={0}
                max={23}
                className="w-20"
                value={form.quiet_hours.start}
                onChange={(e) =>
                  setField("quiet_hours", { ...form.quiet_hours, start: Number(e.target.value) })
                }
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="number"
                min={0}
                max={23}
                className="w-20"
                value={form.quiet_hours.end}
                onChange={(e) =>
                  setField("quiet_hours", { ...form.quiet_hours, end: Number(e.target.value) })
                }
              />
              <span className="text-xs text-muted-foreground">
                No messages send during these hours. AI reschedules to the next allowed window.
              </span>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Retry interval rules</Label>
            <div className="rounded-lg border p-3 bg-muted/30 font-mono text-sm">{retrySummary}</div>
            <p className="text-xs text-muted-foreground">
              Default cadence after the immediate first attempt. AI shifts these based on quiet hours and customer response.
            </p>
          </div>

          <div className="space-y-3 md:col-span-2 rounded-lg border p-4">
            <Label className="flex items-center gap-1 text-sm font-semibold">Escalation rules</Label>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Escalate after N attempts</Label>
                <Input
                  type="number"
                  min={1}
                  max={form.max_retries}
                  value={form.escalation_rules.escalate_after_attempts}
                  onChange={(e) =>
                    setField("escalation_rules", {
                      ...form.escalation_rules,
                      escalate_after_attempts: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Escalation tone</Label>
                <Select
                  value={form.escalation_rules.escalate_tone}
                  onValueChange={(v) =>
                    setField("escalation_rules", {
                      ...form.escalation_rules,
                      escalate_tone: v as "warm" | "neutral" | "urgent",
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <div>
                  <Label className="text-xs">Notify owner on final failure</Label>
                  <p className="text-[11px] text-muted-foreground">Send an alert if recovery fails entirely.</p>
                </div>
                <Switch
                  checked={form.escalation_rules.notify_owner_on_final_failure}
                  onCheckedChange={(v) =>
                    setField("escalation_rules", {
                      ...form.escalation_rules,
                      notify_owner_on_final_failure: v,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Communication Priority */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Communication Priority</CardTitle>
          <CardDescription>
            AI selects the best available channel per customer, using this order as a tiebreaker. Reorder to reflect your preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {form.preferred_channels.map((ch, i) => {
            const meta = CHANNEL_META[ch];
            const Icon = meta.icon;
            return (
              <div key={ch} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="w-6 text-center font-mono text-sm text-muted-foreground">{i + 1}</span>
                <Icon className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.desc}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => moveChannel(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveChannel(i, 1)}
                  disabled={i === form.preferred_channels.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {!form.preferred_channels.includes("push") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setField("preferred_channels", [...form.preferred_channels, "push"])}
            >
              <Bell className="h-4 w-4 mr-1" /> Add Push Notification
            </Button>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            Voice Call channel is on the roadmap. AI will incorporate it automatically when released.
          </p>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save strategy</>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4 border-t">
        AI automatically creates and optimizes every recovery message. Prompt customization is
        available for enterprise admins under <strong>Settings → AI Configuration → Prompt Library</strong>.
      </p>
    </div>
  );
}
