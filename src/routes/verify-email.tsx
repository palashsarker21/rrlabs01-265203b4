import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MailOpen, RefreshCw, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/brand-mark";
import { AuthFooter } from "@/components/auth/auth-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
  head: () => ({
    meta: [
      { title: "Verify your email — RRLabs" },
      { name: "description", content: "Verifying your RRLabs account email." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Status = "pending" | "verified" | "failed";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    // Supabase confirms via the hash flow and calls onAuthStateChange.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("error")) {
      const err = new URLSearchParams(hash.slice(1));
      setStatus("failed");
      setMessage(err.get("error_description") ?? "This verification link is invalid or expired.");
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
      if (data.user?.email_confirmed_at) {
        setStatus("verified");
        setTimeout(() => navigate({ to: "/app", replace: true }), 1500);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email) setEmail(session.user.email);
      if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
        setStatus("verified");
        setTimeout(() => navigate({ to: "/app", replace: true }), 1500);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    if (status === "verified" || resendState === "sending" || cooldown > 0) return;
    const target = email.trim();
    if (!target || !/^\S+@\S+\.\S+$/.test(target)) {
      setResendState("error");
      setResendError("Enter a valid email address.");
      return;
    }
    setResendState("sending");
    setResendError("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: { emailRedirectTo: `${window.location.origin}/verify-email` },
      });
      if (error) throw error;
      setResendState("sent");
      setCooldown(60);
      toast.success("Verification email sent. Check your inbox.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send verification email.";
      // Status-safe: don't leak whether the account exists / is already verified
      const safe = /rate|too many|429/i.test(msg)
        ? "Too many requests. Please wait a moment and try again."
        : "If your account needs verification, a new link has been sent.";
      setResendState("error");
      setResendError(safe);
      toast.error(safe);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/60 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="mb-4 flex justify-center">
          <BrandMark size={40} />
        </div>
        {status === "pending" && (
          <>
            <MailOpen className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ve sent a verification link to your email. Click it to activate your account.
            </p>
            <Loader2
              className="mx-auto mt-6 h-5 w-5 animate-spin text-muted-foreground"
              aria-label="Waiting for verification"
            />
          </>
        )}
        {status === "verified" && (
          <div aria-live="polite">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold">Email verified</h1>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting you to your workspace…</p>
          </div>
        )}
        {status === "failed" && (
          <div role="alert">
            <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold">Verification failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <Button asChild className="mt-6">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        )}

        {status !== "verified" && (
          <div className="mt-6 border-t border-border/60 pt-6 text-left">
            <Label
              htmlFor="resend-email"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Didn&apos;t get the email?
            </Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={resendState === "sending"}
              />
              <Button
                type="button"
                onClick={handleResend}
                disabled={resendState === "sending" || cooldown > 0}
                className="shrink-0"
              >
                {resendState === "sending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                    Resend email
                  </>
                )}
              </Button>
            </div>
            <div className="mt-2 min-h-5 text-xs" aria-live="polite">
              {resendState === "sent" && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  If your account needs verification, a new link is on its way.
                </span>
              )}
              {resendState === "error" && <span className="text-destructive">{resendError}</span>}
            </div>
          </div>
        )}
        <AuthFooter />
      </div>
    </div>
  );
}
