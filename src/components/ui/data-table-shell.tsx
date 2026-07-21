import * as React from "react";
import { cn } from "@/lib/utils";

export interface DataTableShellProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  pagination?: React.ReactNode;
  /** Optional footnote at the bottom-left of the footer (e.g. "12 of 148 rows"). */
  meta?: React.ReactNode;
}

/**
 * Presentational shell around any table body. Provides consistent header,
 * toolbar bar, scroll container, and footer/pagination alignment. Opt-in —
 * existing tables can migrate one at a time without prop changes.
 */
export function DataTableShell({
  title,
  description,
  actions,
  toolbar,
  pagination,
  meta,
  className,
  children,
  ...props
}: DataTableShellProps) {
  const hasHeader = Boolean(title || description || actions);
  const hasFooter = Boolean(meta || pagination);
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-elevated overflow-hidden",
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            {title ? <h2 className="text-h3 text-foreground truncate">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-5 py-3">
          {toolbar}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
      {hasFooter ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-3">
          <div className="text-xs text-muted-foreground">{meta}</div>
          <div className="flex items-center gap-2">{pagination}</div>
        </div>
      ) : null}
    </div>
  );
}
