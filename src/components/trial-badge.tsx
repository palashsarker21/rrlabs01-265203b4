import { Link } from "@tanstack/react-router";
import { AlertCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrialInfo } from "@/lib/trial";
import { workspaceStateLabel } from "@/lib/trial";

const TONE: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export function WorkspaceStatusBadge({ status }: { status: string | null | undefined }) {
  const { label, tone } = workspaceStateLabel(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE[tone],
      )}
    >
      {label}
    </span>
  );
}

export function TrialBadge({ trial }: { trial: TrialInfo }) {
  if (!trial.isTrial) return null;
  const tone = trial.isExpired ? "warning" : trial.daysRemaining <= 3 ? "warning" : "info";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE[tone],
      )}
    >
      <Sparkles className="h-3 w-3" />
      {trial.isExpired
        ? "Trial Expired"
        : `Free Trial · ${trial.daysRemaining} ${trial.daysRemaining === 1 ? "day" : "days"} remaining`}
    </span>
  );
}

export function TrialReminderBanner({ trial }: { trial: TrialInfo }) {
  if (!trial.isTrial) return null;
  const showReminder =
    trial.isExpired || trial.daysRemaining <= 7;
  if (!showReminder) return null;

  const headline = trial.isExpired
    ? "Your free trial has ended"
    : trial.daysRemaining <= 1
      ? "Your trial ends today"
      : `${trial.daysRemaining} days left in your free trial`;
  const sub = trial.isExpired
    ? "Upgrade to continue recovering failed payments."
    : "Upgrade any time to keep your recovery engine running after the trial.";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        trial.isExpired ? TONE.warning : TONE.info,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-medium">{headline}</p>
          <p className="text-xs opacity-80">{sub}</p>
        </div>
      </div>
      <Button asChild size="sm" variant={trial.isExpired ? "default" : "outline"}>
        <Link to="/pricing">{trial.isExpired ? "Upgrade now" : "View plans"}</Link>
      </Button>
    </div>
  );
}
