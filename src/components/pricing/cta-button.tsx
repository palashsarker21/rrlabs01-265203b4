import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveCta, type CtaContext } from "@/lib/billing";

type Props = CtaContext & {
  variant?: "primary" | "outline";
  size?: "default" | "lg" | "sm";
  className?: string;
  fullWidth?: boolean;
};

/**
 * Renders the correct pricing CTA — sign-up, checkout, manage, contact
 * sales, or a disabled "Coming Soon" — based on session + plan state.
 */
export function CtaButton({
  variant = "primary",
  size = "default",
  className,
  fullWidth,
  ...ctx
}: Props) {
  const state = resolveCta(ctx);
  const isPrimary = variant === "primary";

  const btnClass = cn(
    "rounded-full transition-colors",
    fullWidth && "w-full",
    isPrimary
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100",
    className,
  );

  if (state.disabled) {
    return (
      <Button
        type="button"
        disabled
        size={size}
        className={cn(btnClass, "cursor-not-allowed opacity-70")}
        aria-label={`${ctx.plan.name} — ${state.label}`}
      >
        <Lock className="mr-1.5 h-4 w-4" />
        {state.label}
      </Button>
    );
  }

  return (
    <Link to={state.href} className={cn(fullWidth && "block")}>
      <Button size={size} className={btnClass} aria-label={`${ctx.plan.name} — ${state.label}`}>
        {state.label}
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </Link>
  );
}
