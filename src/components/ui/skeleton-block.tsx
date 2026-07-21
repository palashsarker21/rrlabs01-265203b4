import * as React from "react";
import { cn } from "@/lib/utils";

function Base({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-5 shadow-elevated", className)}
      aria-hidden="true"
    >
      <Base className="h-3 w-20" />
      <Base className="mt-4 h-8 w-28" />
      <Base className="mt-3 h-3 w-16" />
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0",
        className,
      )}
      aria-hidden="true"
    >
      <Base className="size-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Base className="h-3 w-1/3" />
        <Base className="h-3 w-1/5" />
      </div>
      <Base className="h-6 w-16" />
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-5 shadow-elevated", className)}
      aria-hidden="true"
    >
      <Base className="h-4 w-32" />
      <Base className="mt-4 h-48 w-full" />
    </div>
  );
}

export { Base as SkeletonBlock };
