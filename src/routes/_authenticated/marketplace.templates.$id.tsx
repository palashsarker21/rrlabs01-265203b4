import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";
import { PERMISSIONS } from "@/lib/rbac";
import { usePermissions } from "@/lib/rbac/use-permissions";
import { getMarketplaceTemplate, installTemplate } from "@/lib/marketplace/marketplace.functions";

export const Route = createFileRoute("/_authenticated/marketplace/templates/$id")({
  component: TemplateDetailPage,
});

function TemplateDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const access = useAccess();
  const workspaceId = access.ctx.workspaceId;
  const { has } = usePermissions(workspaceId);
  const canInstall = has(PERMISSIONS.TEMPLATES_WRITE);

  const get = useServerFn(getMarketplaceTemplate);
  const install = useServerFn(installTemplate);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", "template", id],
    queryFn: () => get({ data: { id } }),
  });

  const t = data?.template;
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [installing, setInstalling] = useState(false);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!t) return <div className="p-8">Template not found.</div>;

  const effectiveSubject = subject || t.subject || "";
  const effectiveBody = body || t.body_text || "";

  const handleInstall = async () => {
    if (!workspaceId) {
      toast.error("Select a workspace first");
      return;
    }
    setInstalling(true);
    try {
      const res = await install({
        data: {
          workspaceId,
          marketplaceTemplateId: t.id,
          overrides: {
            subject: subject || null,
            body_text: body || null,
          },
        },
      });
      toast.success(`Installed at step ${res.step}`);
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
        <h1 className="text-2xl font-semibold">{t.name}</h1>
        <p className="text-muted-foreground">{t.description}</p>
        <div className="flex flex-wrap gap-2">
          {t.industry && <Badge variant="secondary">{t.industry}</Badge>}
          {t.region && <Badge variant="secondary">{t.region}</Badge>}
          <Badge variant="secondary">{t.language}</Badge>
          <Badge variant="outline">{t.channel}</Badge>
          {t.failure_classification && <Badge variant="outline">{t.failure_classification}</Badge>}
          {t.tone && <Badge variant="outline">{t.tone}</Badge>}
          <Badge variant="outline">Step {t.step}</Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customize before install</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {t.channel === "email" && (
              <div className="space-y-2">
                <Label htmlFor="subject">Subject override</Label>
                <Input
                  id="subject"
                  placeholder={t.subject ?? ""}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="body">Body override</Label>
              <Textarea
                id="body"
                rows={12}
                placeholder={t.body_text ?? ""}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the original text. Variables like{" "}
                <code className="bg-muted px-1 rounded">{"{{first_name}}"}</code> are substituted at
                send time.
              </p>
            </div>

            <Button
              className="w-full"
              disabled={!canInstall || installing || !workspaceId}
              onClick={handleInstall}
            >
              {installing ? (
                "Installing…"
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install into workspace
                </>
              )}
            </Button>
            {!canInstall && workspaceId && (
              <p className="text-xs text-muted-foreground">
                You need <code>templates.write</code> permission to install.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {t.channel === "email" && effectiveSubject && (
              <div className="rounded border p-3 bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Subject</div>
                <div className="font-medium">{effectiveSubject}</div>
              </div>
            )}
            <div className="rounded border p-4 whitespace-pre-wrap text-sm">{effectiveBody}</div>
            {t.tags?.length ? (
              <div className="flex gap-1 flex-wrap">
                {t.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    #{tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
              <Check className="h-3 w-3" /> {t.usage_count} workspaces have installed this
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
