import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";
import {
  adminListMarketplaceTemplates,
  adminUpsertMarketplaceTemplate,
  adminDeleteMarketplaceTemplate,
} from "@/lib/marketplace/marketplace.functions";

export const Route = createFileRoute("/_authenticated/admin/marketplace")({
  component: AdminMarketplacePage,
});

type AdminTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  industry: string | null;
  region: string | null;
  country: string | null;
  language: string;
  channel: "email" | "whatsapp";
  failure_classification: string | null;
  tone: string | null;
  step: number;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  tags: string[];
  usage_count: number;
  updated_at: string;
};

function AdminMarketplacePage() {
  const access = useAccess();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListMarketplaceTemplates);
  const upsertFn = useServerFn(adminUpsertMarketplaceTemplate);
  const deleteFn = useServerFn(adminDeleteMarketplaceTemplate);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "marketplace-templates"],
    enabled: access.ctx.isSuperAdmin,
    queryFn: () => listFn({ data: {} }),
  });

  const [editing, setEditing] = useState<Partial<AdminTemplate> | null>(null);

  if (!access.ctx.isSuperAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Super admin only</h1>
      </div>
    );
  }

  const save = async () => {
    if (!editing) return;
    try {
      await upsertFn({
        data: {
          id: editing.id,
          slug: editing.slug ?? "",
          name: editing.name ?? "",
          description: editing.description ?? null,
          status: (editing.status ?? "draft") as "draft" | "published" | "archived",
          industry: editing.industry ?? null,
          region: editing.region ?? null,
          country: editing.country ?? null,
          language: editing.language ?? "en",
          channel: (editing.channel ?? "email") as "email" | "whatsapp",
          failure_classification: editing.failure_classification ?? null,
          tone: editing.tone ?? null,
          step: editing.step ?? 1,
          subject: editing.subject ?? null,
          body_text: editing.body_text ?? null,
          body_html: editing.body_html ?? null,
          tags: editing.tags ?? [],
        },
      });
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-templates"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-templates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const items = (data?.items ?? []) as AdminTemplate[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Admin
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold mt-2">Marketplace templates</h1>
          <p className="text-muted-foreground text-sm">
            Curated single-message templates browsed by every workspace.
          </p>
        </div>
        <Dialog
          open={editing !== null}
          onOpenChange={(o) => setEditing(o ? (editing ?? {}) : null)}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({})}>
              <Plus className="h-4 w-4 mr-1" />
              New template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit" : "New"} template</DialogTitle>
            </DialogHeader>
            {editing && <EditorForm value={editing} onChange={setEditing} />}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Industry / Region</th>
                  <th className="p-3">Lang / Channel</th>
                  <th className="p-3">Installs</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.slug}</div>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          t.status === "published"
                            ? "default"
                            : t.status === "archived"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {t.industry ?? "—"} / {t.region ?? "—"}
                    </td>
                    <td className="p-3">
                      {t.language} / {t.channel}
                    </td>
                    <td className="p-3">{t.usage_count}</td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(t)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => del(t.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No templates yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EditorForm({
  value,
  onChange,
}: {
  value: Partial<AdminTemplate>;
  onChange: (v: Partial<AdminTemplate>) => void;
}) {
  const set = <K extends keyof AdminTemplate>(k: K, v: AdminTemplate[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Slug">
          <Input
            value={value.slug ?? ""}
            onChange={(e) => set("slug", e.target.value)}
          />
        </Field>
        <Field label="Name">
          <Input
            value={value.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Description">
        <Textarea
          rows={2}
          value={value.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Status">
          <Select
            value={value.status ?? "draft"}
            onValueChange={(v) => set("status", v as AdminTemplate["status"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Channel">
          <Select
            value={value.channel ?? "email"}
            onValueChange={(v) => set("channel", v as AdminTemplate["channel"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Step">
          <Input
            type="number"
            min={1}
            max={20}
            value={value.step ?? 1}
            onChange={(e) => set("step", parseInt(e.target.value) || 1)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Industry">
          <Input
            value={value.industry ?? ""}
            onChange={(e) => set("industry", e.target.value || null)}
          />
        </Field>
        <Field label="Region">
          <Input
            value={value.region ?? ""}
            onChange={(e) => set("region", e.target.value || null)}
          />
        </Field>
        <Field label="Language">
          <Input
            value={value.language ?? "en"}
            onChange={(e) => set("language", e.target.value)}
          />
        </Field>
        <Field label="Failure class">
          <Input
            value={value.failure_classification ?? ""}
            onChange={(e) => set("failure_classification", e.target.value || null)}
            placeholder="e.g. soft_decline"
          />
        </Field>
      </div>
      {value.channel !== "whatsapp" && (
        <Field label="Subject">
          <Input
            value={value.subject ?? ""}
            onChange={(e) => set("subject", e.target.value)}
          />
        </Field>
      )}
      <Field label="Body">
        <Textarea
          rows={10}
          className="font-mono text-sm"
          value={value.body_text ?? ""}
          onChange={(e) => set("body_text", e.target.value)}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
