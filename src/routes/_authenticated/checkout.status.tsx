import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight, CheckCircle2, Loader2, XCircle, MailQuestion } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { getCheckoutSessionStatus } from "@/lib/billing.functions";

const search = z.object({ session: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/checkout/status")({
  validateSearch: (raw) => search.parse(raw),
  head: () => ({
    meta: [
      { title: "Finalizing your subscription — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutStatusPage,
});

function CheckoutStatusPage() {
  const { session: sessionId } = useSearch({ from: "/_authenticated/checkout/status" });
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getCheckoutSessionStatus);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["checkout-status", sessionId],
    queryFn: () => fetchStatus({ data: { sessionId } }),
    // Poll every 2s until we reach a terminal state.
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s === "completed" || s === "failed" || s === "timeout" || s === "not_found"
        ? false
        : 2000;
    },
    refetchOnWindowFocus: true,
  });

  // Auto-forward to the workspace as soon as fulfillment lands.
  useEffect(() => {
    if (data?.state === "completed") {
      const t = setTimeout(() => navigate({ to: "/app" }), 1500);
      return () => clearTimeout(t);
    }
  }, [data?.state, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <BrandLockup />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
        {isLoading || !data ? (
          <StatusCard
            icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />}
            title="Checking your payment…"
            body="One moment while we look up your checkout session."
          />
        ) : data.state === "pending" ? (
          <StatusCard
            icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />}
            title="Finalizing your subscription"
            body={
              <>
                Payment received. We're provisioning
                {data.organizationName ? ` ${data.organizationName}` : " your workspace"} now — this
                usually takes just a few seconds. Please keep this tab open.
              </>
            }
          >
            <p className="mt-6 text-xs text-muted-foreground">
              Waiting for confirmation from Lemon Squeezy…
            </p>
          </StatusCard>
        ) : data.state === "completed" ? (
          <StatusCard
            icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />}
            title="You're all set"
            body={
              <>
                {data.planName ? `${data.planName} plan` : "Your subscription"} is active
                {data.organizationName ? ` for ${data.organizationName}` : ""}. Redirecting to your
                workspace…
              </>
            }
          >
            <Button className="mt-6" size="lg" onClick={() => navigate({ to: "/app" })}>
              Continue to your workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </StatusCard>
        ) : data.state === "failed" ? (
          <StatusCard
            icon={<XCircle className="h-8 w-8 text-destructive" />}
            title="Payment could not be completed"
            body="Lemon Squeezy reported that this checkout failed. No charge was made. You can try again or contact us for help."
          >
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/checkout">
                <Button size="lg">Try checkout again</Button>
              </Link>
              <Link to="/contact-sales">
                <Button size="lg" variant="outline">
                  Contact support
                </Button>
              </Link>
            </div>
          </StatusCard>
        ) : data.state === "timeout" ? (
          <StatusCard
            icon={<MailQuestion className="h-8 w-8 text-amber-600" />}
            title="Still processing"
            body="Your payment is taking longer than expected to confirm. If you completed checkout, your workspace will be ready shortly — we'll email you when it is."
          >
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => refetch()}>
                Check again
              </Button>
              <Link to="/contact-sales">
                <Button size="lg" variant="outline">
                  Contact support
                </Button>
              </Link>
            </div>
          </StatusCard>
        ) : (
          <StatusCard
            icon={<XCircle className="h-8 w-8 text-destructive" />}
            title="Checkout session not found"
            body="We couldn't find this checkout session on your account. If you just paid, please refresh in a few seconds."
          >
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => refetch()}>
                Refresh
              </Button>
              <Link to="/pricing">
                <Button size="lg" variant="outline">
                  Back to pricing
                </Button>
              </Link>
            </div>
          </StatusCard>
        )}
      </main>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card/40 p-8 shadow-sm">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
