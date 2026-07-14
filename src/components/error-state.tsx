import { Link } from "@tanstack/react-router";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CONTACT } from "@/lib/brand";

/**
 * Consistent inline error / empty / loading states so no view ever renders
 * a blank screen or unlabelled spinner.
 */

export function ErrorStateView({
  title = "Something went wrong",
  message = "We couldn't load this section. You can retry or head back home.",
  onRetry,
  supportEmail = CONTACT.supportEmail,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  supportEmail?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={
        "flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center " +
        (className ?? "")
      }
    >
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
          </Button>
        )}
        <Link to="/">
          <Button size="sm" variant="outline">
            Go home
          </Button>
        </Link>
        <a href={`mailto:${supportEmail}`}>
          <Button size="sm" variant="ghost">
            Contact support
          </Button>
        </a>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
  className,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-border/60 bg-card/40 p-8 text-center " +
        (className ?? "")
      }
    >
      <div className="text-muted-foreground">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/30 p-8 text-center " +
        (className ?? "")
      }
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded bg-muted/60" />
      ))}
    </div>
  );
}
