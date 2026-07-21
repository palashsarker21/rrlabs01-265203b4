import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** e.g. "+12.4%" or "-3.1%" — sign drives color. Pass a number for auto-formatting. */
  delta?: string | number | null;
  /** Text shown next to the delta chip. */
  deltaLabel?: React.ReactNode;
  footnote?: React.ReactNode;
  loading?: boolean;
}

function formatDelta(delta: string | number): { text: string; dir: "up" | "down" | "flat" } {
  if (typeof delta === "number") {
    const sign = delta > 0 ? "+" : "";
    return {
      text: `${sign}${delta.toFixed(1)}%`,
      dir: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    };
  }
  const trimmed = delta.trim();
  const dir = trimmed.startsWith("-") ? "down" : trimmed.startsWith("+") ? "up" : "flat";
  return { text: trimmed, dir };
}

export function StatCard({
  eyebrow,
  label,
  value,
  icon,
  delta,
  deltaLabel,
  footnote,
  loading,
  className,
  ...props
}: StatCardProps) {
  const chip = delta !== undefined && delta !== null && delta !== "" ? formatDelta(delta) : null;
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-elevated card-hover",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <div className="text-eyebrow">{eyebrow}</div> : null}
          <div className="text-sm font-medium text-muted-foreground truncate">{label}</div>
        </div>
        {icon ? (
          <div
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
        )}
      </div>
      {(chip || footnote) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {chip ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular-nums ring-1 ring-inset",
                chip.dir === "up" &&
                  "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] ring-[hsl(var(--success)/0.25)]",
                chip.dir === "down" &&
                  "bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] ring-[hsl(var(--destructive)/0.25)]",
                chip.dir === "flat" && "bg-muted text-muted-foreground ring-border",
              )}
            >
              {chip.dir === "up" ? (
                <ArrowUpRight className="size-3" />
              ) : chip.dir === "down" ? (
                <ArrowDownRight className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
              {chip.text}
            </span>
          ) : null}
          {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
          {footnote ? <span className="text-muted-foreground">{footnote}</span> : null}
        </div>
      )}
    </div>
  );
}
