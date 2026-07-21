import * as React from "react";
import {
  AlertCircle,
  Brain,
  Gauge,
  Mail,
  MessageCircle,
  RotateCw,
  CircleDollarSign,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/ui/section-card";

type Step = {
  key: string;
  title: string;
  eta: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "info" | "warn" | "success";
};

const STEPS: Step[] = [
  { key: "failed", title: "Failed Payment", eta: "t=0", icon: AlertCircle, tone: "warn" },
  { key: "ai", title: "AI Analysis", eta: "+2s", icon: Brain, tone: "info" },
  { key: "score", title: "Recovery Score", eta: "+3s", icon: Gauge, tone: "info" },
  { key: "email", title: "Email", eta: "+1h", icon: Mail, tone: "neutral" },
  { key: "whatsapp", title: "WhatsApp", eta: "+6h", icon: MessageCircle, tone: "neutral" },
  { key: "retry", title: "Retry Schedule", eta: "+24h", icon: RotateCw, tone: "neutral" },
  {
    key: "recovered",
    title: "Recovered Revenue",
    eta: "≤ 7d",
    icon: CircleDollarSign,
    tone: "success",
  },
];

const toneStyles: Record<Step["tone"], string> = {
  neutral: "bg-muted text-foreground ring-border",
  info: "bg-primary/10 text-primary ring-primary/30",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
};

export interface RecoveryWorkflowDiagramProps {
  activeKey?: Step["key"];
  className?: string;
}

export function RecoveryWorkflowDiagram({
  activeKey = "ai",
  className,
}: RecoveryWorkflowDiagramProps) {
  return (
    <SectionCard
      className={cn(className)}
      title="Recovery workflow"
      description="How every failed payment moves from detection to recovered revenue."
    >
      {/* Desktop: horizontal stepper */}
      <ol
        className="hidden lg:flex items-stretch gap-1 overflow-x-auto"
        aria-label="Recovery workflow steps"
      >
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = step.key === activeKey;
          return (
            <React.Fragment key={step.key}>
              <li className="flex-1 min-w-[9.5rem]">
                <div
                  className={cn(
                    "group h-full rounded-lg border bg-card p-3 transition-colors",
                    isActive
                      ? "border-primary/50 shadow-elevated"
                      : "border-border/60 hover:border-primary/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full ring-1",
                      toneStyles[step.tone],
                      isActive && "animate-pulse",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="mt-3 text-sm font-medium text-foreground">{step.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {step.eta}
                  </div>
                </div>
              </li>
              {idx < STEPS.length - 1 && (
                <li aria-hidden="true" className="flex items-center text-muted-foreground/60">
                  <ChevronRight className="size-4" />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Mobile/tablet: vertical stepper */}
      <ol className="lg:hidden space-y-3" aria-label="Recovery workflow steps">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = step.key === activeKey;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                isActive ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card",
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
                  toneStyles[step.tone],
                  isActive && "animate-pulse",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{step.title}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{step.eta}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
