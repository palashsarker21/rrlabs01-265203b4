import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared Recharts tooltip content. Matches the elevated card treatment
 * used across dashboard + analytics so tooltips read as first-class UI
 * instead of raw popovers.
 */
export interface ChartTooltipProps {
  active?: boolean;
  label?: React.ReactNode;
  labelFormatter?: (label: unknown) => React.ReactNode;
  payload?: Array<{
    name?: string;
    dataKey?: string;
    value?: number | string;
    color?: string;
  }>;
  valueFormatter?: (value: number | string, name?: string) => React.ReactNode;
  className?: string;
}

export function ChartTooltipContent({
  active,
  label,
  labelFormatter,
  payload,
  valueFormatter,
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      role="tooltip"
      className={cn(
        "min-w-[10rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-elevated",
        className,
      )}
    >
      {label !== undefined ? (
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      ) : null}
      <ul className="space-y-1">
        {payload.map((row, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-foreground/90">
              <span
                aria-hidden="true"
                className="size-2 rounded-sm"
                style={{ background: row.color }}
              />
              {row.name ?? row.dataKey}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {row.value !== undefined
                ? valueFormatter
                  ? valueFormatter(row.value, row.name)
                  : String(row.value)
                : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
