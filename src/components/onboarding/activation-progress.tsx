import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Circle,
  Rocket,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  Copy,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ActivationStepId =
  | "permission"
  | "required"
  | "verified"
  | "webhooks"
  | "activate";

export type StepState = "idle" | "running" | "success" | "failed" | "skipped";

export type ActivationStep = {
  id: ActivationStepId;
  label: string;
  description: string;
  state: StepState;
  error?: string;
  /** ISO timestamp when this step first entered `running`. */
  startedAt?: string;
  /** ISO timestamp when this step reached a terminal state (success/failed/skipped). */
  finishedAt?: string;
  /** Where the user should go to resolve this failure. */
  fix?: { label: string; to: string; hash?: string };
};


const DEFAULT_STEPS: Omit<ActivationStep, "state">[] = [
  {
    id: "permission",
    label: "Verifying permissions",
    description: "Confirming you can activate this workspace.",
  },
  {
    id: "required",
    label: "Checking required providers",
    description: "Store, payment gateway, and email delivery must be connected.",
  },
  {
    id: "verified",
    label: "Validating verification status",
    description: "Every connected provider must pass its latest test.",
  },
  {
    id: "webhooks",
    label: "Scanning webhook health",
    description: "No webhook failures in the last 24 hours.",
  },
  {
    id: "activate",
    label: "Turning on the Recovery Engine",
    description: "Flipping the workspace to active and enabling the engine.",
  },
];

export function initialSteps(): ActivationStep[] {
  return DEFAULT_STEPS.map((s) => ({ ...s, state: "idle" as StepState }));
}

export function useActivationSteps() {
  const [steps, setSteps] = useState<ActivationStep[]>(() => initialSteps());
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const reset = () => setSteps(initialSteps());
  const patch = (id: ActivationStepId, patch: Partial<ActivationStep>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return { steps, setSteps, reset, patch };
}

function iconFor(state: StepState) {
  switch (state) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "skipped":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  }
}

export function ActivationProgress({
  steps,
  onRetry,
  onRetryStep,
  onRetryFailed,
  onGoToDashboard,
  isRunning,
  isComplete,
  isFailed,
}: {
  steps: ActivationStep[];
  onRetry: () => void;
  onRetryStep?: (id: ActivationStepId) => void;
  onRetryFailed?: (ids: ActivationStepId[]) => void;
  onGoToDashboard: () => void;
  isRunning: boolean;
  isComplete: boolean;
  isFailed: boolean;
}) {
  const failedSteps = steps.filter((s) => s.state === "failed");
  const failed = failedSteps[0];
  const done = steps.filter((s) => s.state === "success").length;
  const pct = Math.round((done / steps.length) * 100);

  const [confirmRetryFailed, setConfirmRetryFailed] = useState(false);
  const [confirmRetryAll, setConfirmRetryAll] = useState(false);

  // Auto-scroll into view when kicked off
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isRunning) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isRunning]);

  return (
    <div
      ref={ref}
      className={cn(
        "mt-6 rounded-2xl border p-6",
        isComplete
          ? "border-emerald-500/40 bg-emerald-500/5"
          : isFailed
            ? "border-destructive/40 bg-destructive/5"
            : "border-primary/30 bg-card/60",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : isFailed ? (
            <XCircle className="h-6 w-6 text-destructive" />
          ) : (
            <Rocket className="h-6 w-6 text-primary" />
          )}
          <div>
            <div className="text-sm font-semibold text-foreground">
              {isComplete
                ? "Recovery Engine activated"
                : isFailed
                  ? "Activation blocked"
                  : "Activating Recovery Engine…"}
            </div>
            <div className="text-xs text-muted-foreground">
              {isComplete
                ? "You're live. New failed payments will be recovered automatically."
                : isFailed
                  ? "Fix the highlighted step below and retry."
                  : `Step ${done + (isRunning ? 1 : 0)} of ${steps.length} · ${pct}% complete`}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all duration-500",
            isFailed ? "bg-destructive" : isComplete ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${isFailed ? pct : isComplete ? 100 : Math.max(pct, 4)}%` }}
        />
      </div>

      {/* Steps */}
      <ol className="mt-5 space-y-3">
        {steps.map((s) => (
          <StepRow
            key={s.id}
            step={s}
            isRunning={isRunning}
            onRetryStep={onRetryStep}
          />
        ))}
      </ol>

      {/* Footer actions */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {isFailed && failedSteps.length > 0 && onRetryFailed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetryFailed(failedSteps.map((s) => s.id))}
            disabled={isRunning}
          >
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isRunning && "animate-spin")} />
            Retry failed step{failedSteps.length === 1 ? "" : "s"} ({failedSteps.length})
          </Button>
        )}
        {isFailed && (
          <Button size="sm" onClick={onRetry} disabled={isRunning}>
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isRunning && "animate-spin")} />
            Retry activation
          </Button>
        )}
        {isComplete && (
          <Button size="sm" onClick={onGoToDashboard}>
            Go to dashboard
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {failed?.fix && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          Tip: after fixing "{failed.label.toLowerCase()}", come back and click Retry activation —
          no need to redo earlier steps.
        </div>
      )}
    </div>
  );
}

function StepRow({
  step: s,
  isRunning,
  onRetryStep,
}: {
  step: ActivationStep;
  isRunning: boolean;
  onRetryStep?: (id: ActivationStepId) => void;
}) {
  const hasFailure = s.state === "failed" && !!s.error;
  const [open, setOpen] = useState(hasFailure);

  // Auto-expand when a step transitions into failed.
  useEffect(() => {
    if (hasFailure) setOpen(true);
  }, [hasFailure]);

  const copyError = async () => {
    if (!s.error) return;
    try {
      await navigator.clipboard.writeText(`[${s.id}] ${s.label}: ${s.error}`);
      toast.success("Error copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5">{iconFor(s.state)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => hasFailure && setOpen((v) => !v)}
            disabled={!hasFailure}
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-left text-sm font-medium",
              s.state === "failed" ? "text-destructive" : "text-foreground",
              hasFailure ? "cursor-pointer hover:underline" : "cursor-default",
            )}
            aria-expanded={hasFailure ? open : undefined}
            aria-controls={hasFailure ? `step-details-${s.id}` : undefined}
          >
            <span className="truncate">{s.label}</span>
            {hasFailure && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform",
                  open ? "rotate-180" : "rotate-0",
                )}
              />
            )}
          </button>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              s.state === "success" && "bg-emerald-500/10 text-emerald-500",
              s.state === "failed" && "bg-destructive/10 text-destructive",
              s.state === "running" && "bg-primary/10 text-primary",
              (s.state === "idle" || s.state === "skipped") &&
                "bg-muted text-muted-foreground",
            )}
          >
            {s.state}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{s.description}</div>

        {hasFailure && open && (
          <div
            id={`step-details-${s.id}`}
            className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">Why this failed</div>
              <button
                type="button"
                onClick={copyError}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                aria-label="Copy error message"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-destructive/90">
              {s.error}
            </pre>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-destructive/70">
              step id: {s.id}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onRetryStep && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onRetryStep(s.id)}
                  disabled={isRunning}
                >
                  <RefreshCw
                    className={cn("mr-1.5 h-3 w-3", isRunning && "animate-spin")}
                  />
                  Retry this step
                </Button>
              )}
              {s.fix && (
                <Button asChild size="sm" variant="outline">
                  <Link to={s.fix.to} hash={s.fix.hash}>
                    {s.fix.label}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/** Maps a server error message from `activateWorkspace` to the step it belongs to plus a fix action. */
export function classifyActivationError(message: string): {
  stepId: ActivationStepId;
  fix?: ActivationStep["fix"];
} {
  const m = message.toLowerCase();
  if (m.includes("permission")) {
    return {
      stepId: "permission",
      fix: { label: "View team & roles", to: "/team" },
    };
  }
  if (m.includes("store")) {
    return {
      stepId: "required",
      fix: { label: "Connect a store", to: "/integrations", hash: "store" },
    };
  }
  if (m.includes("gateway") || m.includes("payment")) {
    return {
      stepId: "required",
      fix: { label: "Connect a payment gateway", to: "/integrations", hash: "gateway" },
    };
  }
  if (m.includes("email")) {
    return {
      stepId: "required",
      fix: { label: "Connect email delivery", to: "/integrations", hash: "email" },
    };
  }
  if (m.includes("verified") || m.includes("passing test")) {
    return {
      stepId: "verified",
      fix: { label: "Verify each connection", to: "/integrations" },
    };
  }
  if (m.includes("webhook")) {
    return {
      stepId: "webhooks",
      fix: { label: "Review webhook logs", to: "/notifications" },
    };
  }
  return {
    stepId: "activate",
    fix: { label: "Open integrations", to: "/integrations" },
  };
}
