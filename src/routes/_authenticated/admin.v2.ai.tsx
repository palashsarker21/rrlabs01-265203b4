import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, ShieldAlert, Trash2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  clearAiProviderKey,
  listAiProviders,
  saveAiProviderKey,
  testAiProvider,
  toggleAiProvider,
  type AdminProviderRow,
} from "@/lib/ai/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/v2/ai")({
  component: AiPlatformPage,
  head: () => ({
    meta: [{ title: "AI Platform — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
});

function AiPlatformPage() {
  const list = useServerFn(listAiProviders);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => list({}),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Platform</h1>
        <p className="text-sm text-muted-foreground">
          Manage AI providers, keys, and health. Keys are encrypted at rest (AES-256-GCM) and only super admins can view or update them.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading providers…
        </div>
      ) : (
        <div className="space-y-4">
          {(data?.providers ?? []).map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider }: { provider: AdminProviderRow }) {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const save = useServerFn(saveAiProviderKey);
  const clear = useServerFn(clearAiProviderKey);
  const toggle = useServerFn(toggleAiProvider);
  const test = useServerFn(testAiProvider);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { providerId: provider.id, apiKey } }),
    onSuccess: () => {
      toast.success("API key saved and encrypted");
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["ai-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: () => clear({ data: { providerId: provider.id } }),
    onSuccess: () => {
      toast.success("Stored key removed");
      qc.invalidateQueries({ queryKey: ["ai-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => toggle({ data: { providerId: provider.id, enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-providers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => test({ data: { providerId: provider.id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`OK — ${r.model} in ${r.latency_ms}ms`);
      else toast.error(`Failed (${r.status}): ${r.response_preview.slice(0, 120)}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {provider.name}
              <Badge variant="outline" className="font-mono text-xs">{provider.slug}</Badge>
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">{provider.base_url}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`enabled-${provider.id}`} className="text-xs">Enabled</Label>
            <Switch
              id={`enabled-${provider.id}`}
              checked={provider.enabled}
              onCheckedChange={(v) => toggleMut.mutate(v)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {provider.has_env_key ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Env var set ({provider.secret_env_var})
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <ShieldAlert className="h-3 w-3" /> No env var ({provider.secret_env_var})
            </Badge>
          )}
          {provider.has_stored_key ? (
            <Badge variant="secondary" className="gap-1">
              <KeyRound className="h-3 w-3" /> Stored key
              {provider.api_key_updated_at
                ? ` · updated ${new Date(provider.api_key_updated_at).toLocaleString()}`
                : null}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <KeyRound className="h-3 w-3" /> No stored key
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`key-${provider.id}`}>Set API key</Label>
          <div className="flex gap-2">
            <Input
              id={`key-${provider.id}`}
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider.slug === "openrouter"
                  ? "sk-or-v1-..."
                  : provider.slug === "lovable" || provider.slug === "google"
                    ? "Lovable API key"
                    : "API key"
              }
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide" : "Show"}
            </Button>
            <Button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={apiKey.trim().length < 8 || saveMut.isPending}
            >
              {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored encrypted with AES-256-GCM. Overrides any env var of the same name.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || (!provider.has_env_key && !provider.has_stored_key)}
          >
            {testMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Test connection
          </Button>
          {provider.has_stored_key ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove stored key
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
