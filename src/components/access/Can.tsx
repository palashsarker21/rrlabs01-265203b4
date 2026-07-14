import type { ReactNode } from "react";

import { useAccess } from "@/hooks/use-access";
import type {
  FeatureKey,
  PlanCode,
  Visibility,
  WorkspaceRole,
} from "@/lib/access/config";

interface CanProps {
  /** Explicit visibility level. Defaults to "authenticated" if any other prop is set. */
  visibility?: Visibility;
  role?: WorkspaceRole;
  plan?: PlanCode;
  feature?: FeatureKey;
  requiresWorkspace?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * UI gate — renders `children` only when the current viewer has access.
 * Use everywhere instead of hand-rolled `if (isAdmin) …` checks.
 *
 *   <Can feature="advanced_analytics">
 *     <AnalyticsPanel />
 *   </Can>
 */
export function Can({
  visibility,
  role,
  plan,
  feature,
  requiresWorkspace,
  fallback = null,
  children,
}: CanProps) {
  const { evaluate } = useAccess();
  const v: Visibility =
    visibility ?? (role || plan || feature || requiresWorkspace ? "authenticated" : "public");

  const decision = evaluate({
    path: "__runtime__",
    visibility: v,
    requiredRole: role,
    requiredPlan: plan,
    requiredFeature: feature,
    requiresWorkspace,
  });

  return <>{decision.allowed ? children : fallback}</>;
}
