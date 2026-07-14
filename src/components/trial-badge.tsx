import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, Sparkles, X } from "lucide-react";

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

const DISMISS_KEY = "rrlabs.trialBanner.dismissedAt";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

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
        ? "Trial expired"
        : `Trial · ${trial.daysRemaining} ${trial.daysRemaining === 1 ? "day" : "days"} remaining`}
    </span>
  );
}

export function TrialReminderBanner({ trial }: { trial: TrialInfo }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      setDismissed(false);
      return;
    }
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > DISMISS_TTL_MS) {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDismissed(true);
  }

  if (!trial.isTrial) return null;
  const showReminder = trial.isExpired || trial.daysRemaining <= 7;
  if (!showReminder) return null;
  if (dismissed) return null;

  const headline = trial.isExpired
    ? "Trial expired"
    : trial.daysRemaining <= 1
      ? "Your trial ends today"
      : `Your trial expires in ${trial.daysRemaining} days`;
  const sub = trial.isExpired
    ? "Upgrade to continue automated recovery. Your dashboard stays available."
    : "Upgrade anytime to continue uninterrupted.";

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
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant={trial.isExpired ? "default" : "outline"}>
          <Link to="/pricing">{trial.isExpired ? "Upgrade now" : "Upgrade"}</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {trial.isExpired ? "Later" : "Dismiss"}
          <X className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
