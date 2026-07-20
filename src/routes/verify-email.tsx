import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MailOpen, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/brand-mark";
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

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState<string>("");

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
      if (data.user?.email_confirmed_at) {
        setStatus("verified");
        setTimeout(() => navigate({ to: "/app", replace: true }), 1500);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
        setStatus("verified");
        setTimeout(() => navigate({ to: "/app", replace: true }), 1500);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

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
      </div>
    </div>
  );
}
