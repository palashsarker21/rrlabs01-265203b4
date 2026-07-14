import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
  head: () => ({
    meta: [
      { title: "Workspace — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AppShell() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();
      return { user: userData.user, profile: data };
    },
  });

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, slug, status, recovery_engine_enabled, setup_step")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    // Placeholder: in Phase 2, redirect users with no workspace to the checkout flow.
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.profile?.display_name ?? profile?.user?.email}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-2xl border border-border/60 bg-card/50 p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Welcome to RRLabs
              </h1>
              <p className="text-sm text-muted-foreground">
                Phase 1 foundation is live. Billing, setup wizard, and the recovery engine come next.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Your workspaces
            </h2>
            {workspaces && workspaces.length > 0 ? (
              <ul className="mt-3 divide-y divide-border/60 rounded-lg border border-border/60 bg-background/40">
                {workspaces.map((w) => (
                  <li key={w.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{w.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.status} · setup step {w.setup_step}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {w.recovery_engine_enabled ? "Engine on" : "Engine off"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-background/40 p-6 text-center text-sm text-muted-foreground">
                No workspaces yet. Phase 2 (billing + checkout) will create one automatically after
                subscription.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
