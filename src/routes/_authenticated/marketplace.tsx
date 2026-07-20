import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Sparkles, Filter, LayoutList, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  listMarketplaceTemplates,
  listMarketplaceFlows,
  listMarketplaceFacets,
} from "@/lib/marketplace/marketplace.functions";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({
    meta: [
      { title: "Recovery Template Marketplace · RRLabs" },
      {
        name: "description",
        content:
          "Curated recovery templates and flows by industry, region, language, and channel.",
      },
    ],
  }),
  component: MarketplacePage,
});

const ANY = "__any";

function MarketplacePage() {
  const listTemplates = useServerFn(listMarketplaceTemplates);
  const listFlows = useServerFn(listMarketplaceFlows);
  const listFacets = useServerFn(listMarketplaceFacets);

  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<string>(ANY);
  const [region, setRegion] = useState<string>(ANY);
  const [language, setLanguage] = useState<string>(ANY);
  const [channel, setChannel] = useState<string>(ANY);

  const filters = useMemo(
    () => ({
      industry: industry === ANY ? null : industry,
      region: region === ANY ? null : region,
      language: language === ANY ? null : language,
      channel: (channel === ANY ? null : channel) as "email" | "whatsapp" | null,
      q: q.trim() || null,
    }),
    [industry, region, language, channel, q],
  );

  const facets = useQuery({
    queryKey: ["marketplace", "facets"],
    queryFn: () => listFacets({ data: {} }),
    staleTime: 5 * 60_000,
  });

  const templates = useQuery({
    queryKey: ["marketplace", "templates", filters],
    queryFn: () => listTemplates({ data: filters }),
  });

  const flows = useQuery({
    queryKey: ["marketplace", "flows", filters],
    queryFn: () => listFlows({ data: filters }),
  });

  const clear = () => {
    setQ("");
    setIndustry(ANY);
    setRegion(ANY);
    setLanguage(ANY);
    setChannel(ANY);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Template Marketplace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">
            Recovery flows, curated by industry & region
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Browse RRLabs-curated single-message templates and multi-step flows.
            Install into your workspace with one click — customize before or
            after.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/setup">Back to Setup</Link>
        </Button>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates by name or description…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={clear}>
              <Filter className="h-4 w-4 mr-1" /> Reset
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FacetSelect
              label="Industry"
              value={industry}
              onChange={setIndustry}
              options={facets.data?.industries ?? []}
            />
            <FacetSelect
              label="Region"
              value={region}
              onChange={setRegion}
              options={facets.data?.regions ?? []}
            />
            <FacetSelect
              label="Language"
              value={language}
              onChange={setLanguage}
              options={facets.data?.languages ?? []}
            />
            <FacetSelect
              label="Channel"
              value={channel}
              onChange={setChannel}
              options={facets.data?.channels ?? ["email", "whatsapp"]}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">
            <LayoutList className="h-4 w-4 mr-1" />
            Templates ({templates.data?.items.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="flows">
            <Workflow className="h-4 w-4 mr-1" />
            Flows ({flows.data?.items.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {templates.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : templates.data?.items.length === 0 ? (
            <EmptyState label="No templates match your filters." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(templates.data?.items ?? []).map((t) => (
                <TemplateCard key={t.id} t={t} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flows" className="mt-4">
          {flows.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : flows.data?.items.length === 0 ? (
            <EmptyState label="No flows match your filters." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(flows.data?.items ?? []).map((f) => (
                <FlowCard key={f.id} f={f} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FacetSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Any {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
      {label}
    </div>
  );
}

type TemplateItem = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  region: string | null;
  language: string;
  channel: string;
  failure_classification: string | null;
  tone: string | null;
  step: number;
  tags: string[];
  usage_count: number;
};

function TemplateCard({ t }: { t: TemplateItem }) {
  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="text-base">{t.name}</CardTitle>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {t.description ?? " "}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {t.industry && <Badge variant="secondary">{t.industry}</Badge>}
          {t.region && <Badge variant="secondary">{t.region}</Badge>}
          <Badge variant="secondary">{t.language}</Badge>
          <Badge variant="outline">{t.channel}</Badge>
          {t.failure_classification && (
            <Badge variant="outline">{t.failure_classification}</Badge>
          )}
          {t.tone && <Badge variant="outline">{t.tone}</Badge>}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {t.step}</span>
          <span>{t.usage_count} installs</span>
        </div>
        <Button asChild size="sm" className="w-full">
          <Link
            to="/marketplace/templates/$id"
            params={{ id: t.id }}
          >
            Preview & install
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

type FlowItem = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  region: string | null;
  language: string;
  failure_classification: string | null;
  tone: string | null;
  steps: unknown;
  tags: string[];
  usage_count: number;
};

function FlowCard({ f }: { f: FlowItem }) {
  const stepCount = Array.isArray(f.steps) ? f.steps.length : 0;
  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="text-base">{f.name}</CardTitle>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {f.description ?? " "}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {f.industry && <Badge variant="secondary">{f.industry}</Badge>}
          {f.region && <Badge variant="secondary">{f.region}</Badge>}
          <Badge variant="secondary">{f.language}</Badge>
          <Badge variant="outline">{stepCount} steps</Badge>
          {f.failure_classification && (
            <Badge variant="outline">{f.failure_classification}</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {f.usage_count} installs
        </div>
        <Button asChild size="sm" className="w-full">
          <Link to="/marketplace/flows/$id" params={{ id: f.id }}>
            Preview & install
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
