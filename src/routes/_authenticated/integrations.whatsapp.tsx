import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CONTACT } from "@/lib/brand";
import {
  provisionWhatsAppIntegration,
  getWhatsAppOnboardingState,
  verifyWhatsAppWebhookLive,
  runWhatsAppConnectionTest,
} from "@/lib/whatsapp-onboarding.functions";

export const Route = createFileRoute("/_authenticated/integrations/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Onboarding — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WhatsAppOnboarding,
});

type CopyRowProps = { label: string; value: string; monospace?: boolean };

function CopyRow({ label, value, monospace }: CopyRowProps) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard blocked — copy manually");
    }
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className={cn("flex-1", monospace && "font-mono text-xs")}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="outline" size="icon" onClick={doCopy} aria-label={`Copy ${label}`}>
          {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ label, ok, pendingLabel = "Pending", okLabel = "Connected" }: {
  label: string;
  ok: boolean;
  pendingLabel?: string;
  okLabel?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
        ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-muted bg-muted/30",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
        {ok ? okLabel : pendingLabel}
      </span>
    </div>
  );
}

function WhatsAppOnboarding() {
  const provisionFn = useServerFn(provisionWhatsAppIntegration);
  const stateFn = useServerFn(getWhatsAppOnboardingState);
  const verifyFn = useServerFn(verifyWhatsAppWebhookLive);
  const testFn = useServerFn(runWhatsAppConnectionTest);

  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<
    | { ok: boolean; checks: { name: string; ok: boolean; detail: string }[] }
    | null
  >(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ["whatsapp-onboarding-workspace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const provisionMut = useMutation({
    mutationFn: async (workspaceId: string) => provisionFn({ data: { workspaceId } }),
    onSuccess: (r) => {
      setIntegrationId(r.integrationId);
      setVerifyToken(r.webhookVerifyToken);
      setWebhookSecret(r.webhookSecret);
      toast.success("WhatsApp integration ready — copy the values into Meta");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-provision on first mount once the workspace is known.
  useEffect(() => {
    if (workspace?.id && !integrationId && !provisionMut.isPending) {
      provisionMut.mutate(workspace.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const stateQuery = useQuery({
    queryKey: ["whatsapp-onboarding-state", integrationId],
    enabled: Boolean(integrationId),
    queryFn: () => stateFn({ data: { integrationId: integrationId! } }),
    refetchInterval: 15_000,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.rrlabs.online";
  const productionOrigin = "https://www.rrlabs.online";
  const callbackUrl = useMemo(
    () =>
      integrationId
        ? `${productionOrigin}/api/public/webhooks/whatsapp_cloud/${integrationId}`
        : "",
    [integrationId],
  );

  const verifyMut = useMutation({
    mutationFn: async () => verifyFn({ data: { integrationId: integrationId!, origin } }),
    onSuccess: (r) => {
      setVerifyResult({ ok: r.ok, message: r.message });
      if (r.ok) toast.success("Webhook verified");
      else toast.error(r.message);
    },
    onError: (e: Error) => {
      setVerifyResult({ ok: false, message: e.message });
      toast.error(e.message);
    },
  });

  const testMut = useMutation({
    mutationFn: async () => testFn({ data: { integrationId: integrationId!, origin } }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast.success("All connection checks passed");
      else toast.warning("Some checks failed — review below");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const state = stateQuery.data;
  const webhookConnected = state?.verificationStatus === "verified";
  const messagingEnabled = state?.status === "connected" && state?.lastTestOk === true;

  const checklistItems = [
    { id: "phone", label: "Register phone number in Meta Business Manager" },
    { id: "payment", label: "Add payment method to WhatsApp Business Account" },
    { id: "webhook", label: "Configure webhook (Callback URL + Verify Token)" },
    { id: "business", label: "Complete business verification" },
    { id: "test-message", label: "Send a test message from the WhatsApp API" },
    { id: "publish", label: "Publish the Meta app (move out of Development)" },
  ];

  if (wsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-muted-foreground">No workspace found. Complete onboarding first.</p>
        <Link to="/onboarding" className="mt-4 inline-block text-primary underline">
          Go to onboarding
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/integrations"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Integrations
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Cloud API — Onboarding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Provision the webhook credentials Meta needs, then paste them into the Meta Developer
            Dashboard. Values are generated per integration and stored securely.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs">
          <Sparkles className="h-3 w-3" />
          Workspace: <strong className="ml-1">{workspace.name}</strong>
        </div>
      </div>

      {/* Status badges */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatusBadge label="Webhook" ok={Boolean(webhookConnected)} />
        <StatusBadge
          label="Business"
          ok={Boolean((state?.config as Record<string, unknown> | undefined)?.verified_name)}
          pendingLabel="Pending"
          okLabel="Verified"
        />
        <StatusBadge
          label="Phone"
          ok={Boolean((state?.config as Record<string, unknown> | undefined)?.display_phone_number)}
          pendingLabel="Pending"
          okLabel="Registered"
        />
        <StatusBadge
          label="Messaging"
          ok={messagingEnabled}
          pendingLabel="Disabled"
          okLabel="Enabled"
        />
      </section>

      {/* Step 1 + 2 + 3: Configuration card */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Meta Developer Dashboard values</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Copy these into <em>Meta for Developers → your App → WhatsApp → Configuration → Webhook</em>.
          Callback URL and Verify Token are required for the initial subscribe handshake; the App
          Secret (Webhook Secret) is what Meta uses to sign every incoming event.
        </p>

        {integrationId ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <CopyRow label="Callback URL" value={callbackUrl} monospace />
            </div>
            <CopyRow label="Verify Token" value={verifyToken} monospace />
            <CopyRow label="Webhook Secret (App Secret)" value={webhookSecret} monospace />
            <CopyRow label="WhatsApp Business Phone" value={CONTACT.whatsappBusinessNumber} />
            <CopyRow label="Integration ID" value={integrationId} monospace />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Provisioning integration…
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            onClick={() => verifyMut.mutate()}
            disabled={!integrationId || verifyMut.isPending}
          >
            {verifyMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Verify Webhook
          </Button>
          <Button
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={!integrationId || testMut.isPending}
          >
            {testMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Run Connection Test
          </Button>
        </div>

        {verifyResult && (
          <div
            className={cn(
              "mt-4 flex items-start gap-2 rounded-md border p-3 text-sm",
              verifyResult.ok
                ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200"
                : "border-destructive/40 bg-destructive/5 text-destructive",
            )}
          >
            {verifyResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {verifyResult.ok ? "✅ Connected — " : "❌ Validation failed — "}
              {verifyResult.message}
            </span>
          </div>
        )}

        {testResult && (
          <div className="mt-4 space-y-2 rounded-md border p-3">
            {testResult.checks.map((c) => (
              <div key={c.name} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground"> — {c.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How-to */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Where each value goes in Meta</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Open <strong>developers.facebook.com</strong> → your App → <strong>WhatsApp → Configuration</strong>.</li>
          <li>In the <strong>Webhook</strong> section, click <strong>Edit</strong>.</li>
          <li>Paste the <strong>Callback URL</strong> above into the Callback URL field.</li>
          <li>Paste the <strong>Verify Token</strong> above into the Verify Token field.</li>
          <li>Click <strong>Verify and save</strong> — Meta will GET the Callback URL. Come back and click <strong>Verify Webhook</strong> above to confirm from our side.</li>
          <li>Subscribe to at least the <code>messages</code> field so payment-recovery replies flow in.</li>
          <li>In <strong>App Settings → Basic</strong>, copy the <strong>App Secret</strong> into a safe place. If you want Meta to sign requests with our secret instead, use the Webhook Secret above as the App Secret in the platform that sends events.</li>
          <li>Finish by saving the WhatsApp access token, phone number ID, and WABA ID back on the Integrations page — those unlock actual message sending.</li>
        </ol>
      </section>

      {/* Checklist */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Production checklist</h2>
        <ul className="space-y-2">
          {checklistItems.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={!!checklist[item.id]}
                onChange={(e) => setChecklist((c) => ({ ...c, [item.id]: e.target.checked }))}
              />
              <span className={cn(checklist[item.id] && "text-muted-foreground line-through")}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Encrypted credentials are never shown here. Only the Callback URL, Verify Token, and
        Webhook Secret are exposed — everything else lives inside the encrypted credentials vault.
      </p>
    </div>
  );
}
