import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, MailOpen } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { AuthFooter } from "@/components/auth/auth-footer";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset your password — RRLabs" },
      { name: "description", content: "Request a password reset link for your RRLabs account." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Do NOT reveal whether the email exists — enumeration protection.
      if (error && !/rate/i.test(error.message)) {
        // Only surface rate-limit errors; other failures still show generic success.
        console.warn("resetPasswordForEmail:", error.message);
      }
      setSent(true);
      toast.success("If that email exists, a reset link is on its way.");
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark size={44} />
          <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a secure reset link.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
              <p className="text-sm text-foreground">
                If an account exists for <span className="font-medium">{email}</span>, we&apos;ve
                emailed a reset link. It expires in 1 hour.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t get it? Check spam, then try again in a few minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  ref={inputRef}
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <MailOpen className="mr-2 h-4 w-4" />
                    Send reset link
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 flex justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>
        <AuthFooter />
      </div>
    </div>
  );
}
