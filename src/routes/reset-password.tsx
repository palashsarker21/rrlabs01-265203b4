import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { AuthFooter } from "@/components/auth/auth-footer";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrength, useCapsLock } from "@/components/auth/password-strength";
import { evaluatePassword } from "@/lib/auth/password-policy";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Choose a new password — RRLabs" },
      { name: "description", content: "Set a new password for your RRLabs account." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const capsOn = useCapsLock();

  useEffect(() => {
    // Supabase places the session on the URL hash for the recovery flow.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isRecovery = hash.includes("type=recovery");

    supabase.auth.getSession().then(({ data }) => {
      setRecovery(isRecovery || Boolean(data.session));
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const ev = evaluatePassword(password);
    if (!ev.strong) {
      setError("Please choose a password that meets all requirements.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      toast.success("Password updated. Redirecting…");
      setTimeout(() => navigate({ to: "/app", replace: true }), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={44} />
          <h1 className="text-2xl font-semibold text-foreground">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            Pick something strong. You&apos;ll be signed in automatically.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {!ready ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : !recovery ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                This reset link is invalid or has expired. Please request a new one from the{" "}
                <Link to="/forgot-password" className="underline">
                  forgot password
                </Link>{" "}
                page.
              </span>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
              <p className="text-sm text-foreground">Password updated.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  required
                  autoFocus
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                />
                {capsOn && (
                  <p className="text-xs text-amber-600 dark:text-amber-400" aria-live="polite">
                    Caps Lock is on.
                  </p>
                )}
                <PasswordStrength password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat the password"
                  aria-invalid={confirm.length > 0 && confirm !== password}
                />
                {confirm.length > 0 && confirm !== password && (
                  <p className="text-xs text-destructive" aria-live="polite">
                    Passwords do not match.
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
        <AuthFooter />
      </div>
    </div>
  );
}
