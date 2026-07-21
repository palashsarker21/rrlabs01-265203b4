import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/brand-mark";
import { provisionTrialWorkspace } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: "Create your workspace — RRLabs" }, { name: "robots", content: "noindex" }],
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
  const wsEditedRef = useRef(false);
  const redirectedRef = useRef(false);

  // Existing-workspace protection: if the signed-in user already belongs to a
  // workspace, send them to the app instead of showing onboarding again.
  const { data: existingWorkspaces, isLoading: checkingExisting } = useQuery({
    queryKey: ["onboarding-existing-workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, setup_step, recovery_engine_enabled")
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (redirectedRef.current) return;
    if (!existingWorkspaces || existingWorkspaces.length === 0) return;
    redirectedRef.current = true;
    const ws = existingWorkspaces[0];
    const needsSetup = !ws.recovery_engine_enabled || (ws.setup_step ?? 0) < 3;
    navigate({ to: needsSetup ? "/getting-started" : "/app", replace: true });
  }, [existingWorkspaces, navigate]);

  function handleOrgChange(v: string) {
    setOrgName(v);
    if (!wsEditedRef.current) setWsName(v);
  }

  function handleWsChange(v: string) {
    wsEditedRef.current = true;
    setWsName(v);
  }

  async function handleBack() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const org = orgName.trim();
    const ws = wsName.trim();
    if (org.length < 2 || ws.length < 2) {
      toast.error("Please enter an organization and workspace name.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await provision({
        data: { organizationName: org, workspaceName: ws },
      });
      await qc.invalidateQueries();
      toast.success("Workspace created successfully.");
      redirectedRef.current = true;
      // Fresh workspaces need setup; already-existing ones go straight to the app.
      const destination = result.alreadyExists ? "/app" : "/getting-started";
      navigate({ to: destination, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create your workspace.");
      setSubmitting(false);
    }
  }

  // While we check for an existing workspace, render nothing to avoid a flash
  // of the onboarding form for users who will be redirected away.
  if (checkingExisting || (existingWorkspaces && existingWorkspaces.length > 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <BrandLockup />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-2xl border border-border/60 bg-card/50 p-8 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">14-day free trial</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">Create your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us a little about your company. You'll be inside the product in a few seconds.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="org">Company Name</Label>
              <Input
                id="org"
                value={orgName}
                onChange={(e) => handleOrgChange(e.target.value)}
                placeholder="Acme, Inc."
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ws">Workspace Name</Label>
              <Input
                id="ws"
                value={wsName}
                onChange={(e) => handleWsChange(e.target.value)}
                placeholder="Acme, Inc."
                required
              />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={handleBack} disabled={submitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create Workspace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
