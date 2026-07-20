import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings/security")({
  component: SecuritySettings,
  head: () => ({
    meta: [{ title: "Security — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
});

function SecuritySettings() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleLogoutEverywhere() {
    setBusy(true);
    try {
      // scope: 'global' revokes ALL refresh tokens for the user across every
      // device/browser. Supabase then invalidates the current client session too.
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      // Clear any cached credentials on this device just in case.
      try {
        window.localStorage.removeItem("rememberedEmail");
      } catch {
        /* ignore */
      }
      navigate({
        to: "/signed-out",
        replace: true,
        search: { scope: "global" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not sign out everywhere.";
      toast.error(msg);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Button asChild size="sm" variant="ghost">
          <Link to="/app" aria-label="Back to dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold text-foreground">Security</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage active sessions and account access.
      </p>

      <Card className="mt-8 border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden />
            <CardTitle className="text-base">Log out everywhere</CardTitle>
          </div>
          <CardDescription>
            Revoke every active session for your account on all devices and browsers.
            Anyone signed in as you — including this device — will be signed out
            immediately and required to sign in again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                )}
                Log out everywhere
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of all sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This revokes every refresh token issued to your account. You will need
                  to sign in again on this device and every other device where you were
                  signed in. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLogoutEverywhere}
                  disabled={busy}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {busy ? "Signing out…" : "Yes, log me out everywhere"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
