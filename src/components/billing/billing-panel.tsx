import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, ExternalLink, AlertTriangle, ArrowRight, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWorkspaceBilling } from "@/lib/billing-summary.functions";
import { getWorkspaceSuccessFeeSummary } from "@/lib/success-fee.functions";

function money(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency ?? "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(0)}`;
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingPanel({ workspaceId }: { workspaceId: string }) {
  const fetchBilling = useServerFn(getWorkspaceBilling);
  const fetchFee = useServerFn(getWorkspaceSuccessFeeSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["billing", workspaceId],
    queryFn: () => fetchBilling({ data: { workspaceId } }),
    staleTime: 30_000,
  });
  const { data: fee } = useQuery({
    queryKey: ["billing-success-fee", workspaceId],
    queryFn: () => fetchFee({ data: { workspaceId } }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-6 w-40 animate-pulse rounded bg-muted" />
      </section>
    );
  }

  const sub = data?.subscription;
  const plan = data?.plan;
  const status = sub?.status ?? "on_trial";
  const pastDue = status === "past_due" || status === "unpaid";
  const cancelled = status === "cancelled" || status === "expired";

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Billing</h2>
        </div>
        <span className="rounded px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
          {status.replace("_", " ")}
        </span>
      </div>

      {pastDue && sub?.update_payment_url ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Payment failed.</p>
            <p className="mt-0.5">Update your payment method to keep recovery running.</p>
          </div>
          <a
            href={sub.update_payment_url}
            target="_blank"
            rel="noreferrer noopener"
            className="whitespace-nowrap text-xs font-semibold underline"
          >
            Update card
          </a>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Plan</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {plan?.name ?? "No active plan"}{" "}
            {plan?.price_cents != null && (
              <span className="text-xs font-normal text-muted-foreground">
                {money(plan.price_cents, plan.currency)}/{plan.interval ?? "month"}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            {cancelled ? "Ends" : status === "on_trial" ? "Trial ends" : "Renews"}
          </dt>
          <dd className="mt-1 font-semibold text-foreground">
            {cancelled
              ? fmtDate(sub?.ends_at)
              : status === "on_trial"
                ? fmtDate(sub?.trial_ends_at)
                : fmtDate(sub?.renews_at)}
          </dd>
        </div>
        {sub?.card_last_four ? (
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Payment</dt>
            <dd className="mt-1 font-medium text-foreground">
              {sub.card_brand ?? "Card"} •••• {sub.card_last_four}
            </dd>
          </div>
        ) : null}
        {plan?.success_fee_bps != null ? (
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Success fee</dt>
            <dd className="mt-1 font-medium text-emerald-700 dark:text-emerald-400">
              {(plan.success_fee_bps / 100).toFixed(1)}% on recovered revenue
            </dd>
          </div>
        ) : null}
      </dl>

      {fee && (fee.currentMonth.feeBps > 0 || fee.outstandingInvoice || fee.lastFinalized) ? (
        <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Success fee — {fee.currentMonth.label}
              </h3>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <Link to="/billing/statements" search={{ workspaceId }}>
                View statements
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Recovered this month</div>
              <div className="mt-1 font-semibold text-foreground">
                {money(fee.currentMonth.recoveredCents, plan?.currency ?? "USD")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Accrued fee ({(fee.currentMonth.feeBps / 100).toFixed(1)}%)
              </div>
              <div className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
                {money(fee.currentMonth.accruedFeeCents, plan?.currency ?? "USD")}
              </div>
            </div>
          </div>
          {fee.outstandingInvoice?.ls_checkout_url ? (
            <a
              href={fee.outstandingInvoice.ls_checkout_url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary underline"
            >
              Pay outstanding invoice ({money(
                fee.outstandingInvoice.net_amount_cents,
                fee.outstandingInvoice.currency,
              )})
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/upgrade">
            {plan ? "Change plan" : "Choose plan"}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
        {sub?.customer_portal_url ? (
          <Button asChild size="sm" variant="ghost">
            <a href={sub.customer_portal_url} target="_blank" rel="noreferrer noopener">
              Manage Billing
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
