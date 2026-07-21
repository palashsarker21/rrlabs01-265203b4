import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] ring-1 ring-inset ring-[hsl(var(--success)/0.25)]",
        warning:
          "border-transparent bg-[hsl(var(--warning)/0.14)] text-[hsl(25_100%_25%)] ring-1 ring-inset ring-[hsl(var(--warning)/0.35)]",
        info: "border-transparent bg-[hsl(var(--chart-2)/0.12)] text-[hsl(var(--chart-2))] ring-1 ring-inset ring-[hsl(var(--chart-2)/0.25)]",
        neutral: "border-transparent bg-muted text-muted-foreground ring-1 ring-inset ring-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
