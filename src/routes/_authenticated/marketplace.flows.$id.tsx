import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, Clock, Mail, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";
import { PERMISSIONS } from "@/lib/rbac";
import { usePermissions } from "@/lib/rbac/use-permissions";
import {
  getMarketplaceFlow,
  installFlow,
} from "@/lib/marketplace/marketplace.functions";

export const Route = createFileRoute("/_authenticated/marketplace/flows/$id")({
  component: FlowDetailPage,
});

function formatOffset(mins: number) {
  if (mins < 60) return `+${mins}m`;
  if (mins < 1440) return `+${Math.round(mins / 60)}h`;
  return `+${Math.round(mins / 1440)}d`;
}

function FlowDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const access = useAccess();
  const workspaceId = access.ctx.workspaceId;
  const { has } = usePermissions(workspaceId);
  const canInstall = has(PERMISSIONS.TEMPLATES_WRITE);

  const get = useServerFn(getMarketplaceFlow);
  const install = useServerFn(installFlow);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", "flow", id],
    queryFn: () => get({ data: { id } }),
  });

  const [installing, setInstalling] = useState(false);
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const f = data?.flow;
  if (!f) return <div className="p-8">Flow not found.</div>;

  const steps = (Array.isArray(f.steps) ? f.steps : []) as Array<{
    step: number;
    channel: string;
    offset_minutes: number;
    subject?: string | null;
    body_text?: string | null;
    tone?: string | null;
  }>;

  const handleInstall = async () => {
    if (!workspaceId) {
      toast.error("Select a workspace first");
      return;
    }
    setInstalling(true);
    try {
      const res = await install({
        data: { workspaceId, marketplaceFlowId: f.id },
      });
      toast.success(`Installed ${res.createdTemplateIds.length} template(s)`);
      navigate({ to: "/marketplace" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/marketplace">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to marketplace
        </Link>
      </Button>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{f.name}</h1>
        <p className="text-muted-foreground">{f.description}</p>
        <div className="flex flex-wrap gap-2">
          {f.industry && <Badge variant="secondary">{f.industry}</Badge>}
          {f.region && <Badge variant="secondary">{f.region}</Badge>}
          <Badge variant="secondary">{f.language}</Badge>
          {f.failure_classification && (
            <Badge variant="outline">{f.failure_classification}</Badge>
          )}
          <Badge variant="outline">{steps.length} steps</Badge>
        </div>
      </header>

      <Button
        onClick={handleInstall}
        disabled={!canInstall || installing || !workspaceId}
      >
        {installing ? (
          "Installing…"
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Install entire flow
          </>
        )}
      </Button>
      {!canInstall && workspaceId && (
        <p className="text-xs text-muted-foreground -mt-4">
          You need <code>templates.write</code> permission to install.
        </p>
      )}

      <div className="space-y-4">
        {steps.map((s, idx) => (
          <Card key={idx}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                {s.channel === "email" ? (
                  <Mail className="h-4 w-4" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                Step {s.step} · {s.channel}
              </CardTitle>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatOffset(s.offset_minutes)}
              </span>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {s.subject && (
                <div>
                  <span className="text-xs text-muted-foreground">Subject</span>
                  <div className="font-medium">{s.subject}</div>
                </div>
              )}
              <div className="whitespace-pre-wrap rounded border p-3 bg-muted/30">
                {s.body_text}
              </div>
              {s.tone && (
                <Badge variant="outline" className="text-[10px]">
                  {s.tone}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
