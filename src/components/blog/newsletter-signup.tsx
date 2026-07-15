import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Loader2, Check } from "lucide-react";
import { subscribeToNewsletter } from "@/lib/newsletter.functions";

interface NewsletterSignupProps {
  source?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export function NewsletterSignup({ source = "blog" }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const subscribe = useServerFn(subscribeToNewsletter);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || status === "submitting") return;
    setStatus("submitting");
    setMessage(null);
    try {
      await subscribe({ data: { email, source } });
      setStatus("success");
      setEmail("");
      setMessage("You're subscribed. Watch your inbox for the next issue.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-card p-6">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Mail className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">The RRLabs recovery newsletter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One deep piece a week on failed-payment recovery, subscription retention, and billing
            infrastructure. No spam. Unsubscribe any time.
          </p>
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "submitting"}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subscribing
                </>
              ) : status === "success" ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Subscribed
                </>
              ) : (
                "Subscribe"
              )}
            </button>
          </form>
          {message && (
            <p
              role={status === "error" ? "alert" : "status"}
              className={`mt-2 text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
