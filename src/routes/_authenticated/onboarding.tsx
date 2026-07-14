import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/brand-mark";
import { provisionTrialWorkspace } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your workspace — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const provision = useServerFn(provisionTrialWorkspace);
  const [orgName, setOrgName] = useState("");
  const [wsName, setWsName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const org = orgName.trim();
    const ws = wsName.trim();
    if (org.length < 2 || ws.length < 2) {
      toast.error("Please enter an organization and workspace name.");
      return;
    }
    setSubmitting(true);
    try {
      await provision({ data: { organizationName: org, workspaceName: ws } });
      await qc.invalidateQueries();
      toast.success("Your 14-day free trial has started.");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start your trial.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <span className="text-xs text-muted-foreground">Step 1 of 1</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-2xl border border-border/60 bg-card/50 p-8 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">14-day free trial</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">
            Let's set up your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Two quick details and you're in. No credit card required.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="org">Organization name</Label>
              <Input
                id="org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme, Inc."
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws">Workspace name</Label>
              <Input
                id="ws"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="Production"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting your trial…
                </>
              ) : (
                <>
                  Start 14-day free trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              You'll get full access to RRLabs for 14 days. Upgrade any time — no charge until you do.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
