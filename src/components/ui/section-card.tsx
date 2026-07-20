import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  description,
  actions,
  toolbar,
  footer,
  bodyClassName,
  className,
  children,
  ...props
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-elevated",
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            {title ? (
              <h2 className="text-h3 text-foreground truncate">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-5 py-3">
          {toolbar}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
      {footer ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-3 text-sm text-muted-foreground">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
