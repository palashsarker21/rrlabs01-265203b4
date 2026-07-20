import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrength, useCapsLock } from "@/components/auth/password-strength";
import {
  evaluatePassword,
  generateStrongPassword,
} from "@/lib/auth/password-policy";

export const Route = createFileRoute("/_authenticated/settings/change-password")({
  component: ChangePasswordPage,
  head: () => ({
    meta: [
      { title: "Change password — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
  form?: string;
};

function ChangePasswordPage() {
  const navigate = useNavigate();
  const caps = useCapsLock();

  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const evalNext = useMemo(() => evaluatePassword(next), [next]);
  const confirmMismatch = confirm.length > 0 && confirm !== next;
  const sameAsCurrent = next.length > 0 && next === current;

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!current) e.current = "Enter your current password.";
    if (!next) e.next = "Enter a new password.";
    else if (!evalNext.strong) e.next = "Password does not meet all requirements.";
    else if (next === current) e.next = "New password must be different from your current password.";
    if (!confirm) e.confirm = "Confirm your new password.";
    else if (confirm !== next) e.confirm = "Passwords do not match.";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    if (!email) {
      setErrors({ form: "Could not determine your account email. Please sign in again." });
      return;
    }

    setBusy(true);
    try {
      // Reauthenticate by verifying the current password. This prevents
      // hijack-style changes if the session is left open on a shared device.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (reauthErr) {
        setErrors({ current: "Current password is incorrect." });
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) {
        setErrors({ form: updErr.message });
        return;
      }

      setDone(true);
      toast.success("Password updated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update password.";
      setErrors({ form: msg });
    } finally {
      setBusy(false);
    }
  }

  function fillGenerated() {
    const pw = generateStrongPassword(16);
    setNext(pw);
    setConfirm(pw);
    setErrors((prev) => ({ ...prev, next: undefined, confirm: undefined }));
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
              <CardTitle className="text-base">Password updated</CardTitle>
            </div>
            <CardDescription>
              Your password was changed successfully. For extra safety, you can sign out of every
              other device from the Security page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => navigate({ to: "/app" })}>Back to dashboard</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/_authenticated/settings/security" as never })}>
              Manage sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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

      <h1 className="text-2xl font-semibold text-foreground">Change password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update the password for {email ?? "your account"}. You'll need your current password to confirm.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle className="text-base">New password</CardTitle>
          </div>
          <CardDescription>
            Choose a strong password you don't use elsewhere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Hidden username for password managers */}
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={email ?? ""}
              readOnly
              hidden
            />

            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordInput
                id="current-password"
                name="current-password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  if (errors.current) setErrors((p) => ({ ...p, current: undefined }));
                }}
                aria-invalid={!!errors.current}
                aria-describedby={errors.current ? "current-error" : undefined}
              />
              {errors.current ? (
                <p id="current-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  {errors.current}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-password">New password</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={fillGenerated}
                  className="h-7 text-xs"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Generate strong
                </Button>
              </div>
              <PasswordInput
                id="new-password"
                name="new-password"
                autoComplete="new-password"
                required
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  if (errors.next) setErrors((p) => ({ ...p, next: undefined }));
                }}
                aria-invalid={!!errors.next}
                aria-describedby="new-password-help"
              />
              <div id="new-password-help">
                <PasswordStrength password={next} className="mt-2" />
              </div>
              {caps ? (
                <p role="status" className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  Caps Lock is on.
                </p>
              ) : null}
              {sameAsCurrent ? (
                <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  New password must be different from your current password.
                </p>
              ) : null}
              {errors.next ? (
                <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  {errors.next}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                }}
                aria-invalid={!!errors.confirm || confirmMismatch}
                aria-describedby={
                  errors.confirm || confirmMismatch ? "confirm-error" : undefined
                }
              />
              {(errors.confirm || confirmMismatch) ? (
                <p id="confirm-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  {errors.confirm ?? "Passwords do not match."}
                </p>
              ) : null}
            </div>

            {errors.form ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {errors.form}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => navigate({ to: "/app" })}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        Forgot your current password?{" "}
        <Link to="/forgot-password" className="underline underline-offset-2 hover:text-foreground">
          Reset it via email
        </Link>
        .
      </p>
    </div>
  );
}
