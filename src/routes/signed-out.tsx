import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthFooter } from "@/components/auth/auth-footer";

const searchSchema = z.object({
  scope: z.enum(["global", "local"]).optional(),
});

const REDIRECT_SECONDS = 6;

export const Route = createFileRoute("/signed-out")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SignedOut,
  head: () => ({
    meta: [
      { title: "Signed out — RRLabs" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function SignedOut() {
  const { scope } = Route.useSearch();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  const isGlobal = scope === "global";

  // Defense-in-depth: ensure no lingering local session on this device.
  useEffect(() => {
    void supabase.auth.signOut().catch(() => {});
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    const timeout = window.setTimeout(() => {
      navigate({ to: "/auth", replace: true });
    }, REDIRECT_SECONDS * 1000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          >
            {isGlobal ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {isGlobal ? "You’ve been signed out everywhere" : "You’ve been signed out"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {isGlobal
              ? "All active sessions across every device and browser have been revoked. You’ll need to sign in again to continue."
              : "Your session has ended on this device. You’ll need to sign in again to continue."}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link to="/auth" replace>
                Go to sign in
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/">Return to homepage</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
            Redirecting to sign in in {seconds}s…
          </p>
        </div>
        <AuthFooter />
      </div>
    </main>
  );
}
