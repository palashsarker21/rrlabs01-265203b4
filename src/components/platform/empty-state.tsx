import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * Standard empty-state primitive. Never render a blank list —
 * every empty surface should show explanation + CTA + docs link.
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  docsHref,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; to: string; search?: Record<string, string> };
  docsHref?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
      {icon && <div className="mb-4 rounded-full bg-primary/10 p-3 text-primary">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {(cta || docsHref) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {cta && (
            <Button asChild size="sm">
              <Link to={cta.to as never} search={(cta.search ?? {}) as never}>
                {cta.label}
              </Link>
            </Button>
          )}
          {docsHref && (
            <Button asChild size="sm" variant="outline">
              <a href={docsHref} target="_blank" rel="noreferrer">
                Documentation
              </a>
            </Button>
          )}
        </div>
      )}
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
}
