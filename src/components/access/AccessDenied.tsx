import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import type { DenyReason } from "@/lib/access/policy";
import type { PlanCode } from "@/lib/access/config";

interface Props {
  reason: DenyReason;
  requiredPlan?: PlanCode;
  title?: string;
  message?: string;
}

const COPY: Record<
  DenyReason,
  { title: string; message: string; cta?: { to: string; label: string } }
> = {
  unauthenticated: {
    title: "Sign in required",
    message: "You need to sign in to access this page.",
    cta: { to: "/auth", label: "Sign in" },
  },
  forbidden: {
    title: "Access denied",
    message: "You don't have permission to view this resource.",
    cta: { to: "/app", label: "Back to dashboard" },
  },
  wrong_workspace: {
    title: "Workspace not found",
    message: "This workspace doesn't exist or you're not a member.",
    cta: { to: "/app", label: "Back to dashboard" },
  },
  workspace_suspended: {
    title: "Workspace suspended",
    message: "This workspace has been suspended. Contact support to reactivate.",
    cta: { to: "/contact", label: "Contact support" },
  },
  upgrade_required: {
    title: "Upgrade required",
    message: "This feature is available on a higher plan.",
    cta: { to: "/pricing", label: "See plans" },
  },
  maintenance: {
    title: "Under maintenance",
    message: "RRLabs is temporarily unavailable. We'll be back shortly.",
  },
};

export function AccessDenied({ reason, requiredPlan, title, message }: Props) {
  const base = COPY[reason];
  const finalMsg =
    message ??
    (reason === "upgrade_required" && requiredPlan
      ? `This feature requires the ${requiredPlan} plan or higher.`
      : base.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">{title ?? base.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{finalMsg}</p>
        {base.cta && (
          <div className="mt-6">
            <Button asChild>
              <Link to={base.cta.to}>{base.cta.label}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
