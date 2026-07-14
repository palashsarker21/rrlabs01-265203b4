import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { loadAccessContext } from "@/lib/access/context.functions";
import { ANONYMOUS_ACCESS } from "@/lib/access/types";
import {
  evaluate,
  hasFeature as _hasFeature,
  hasPlan as _hasPlan,
  hasRole as _hasRole,
} from "@/lib/access/policy";
import type {
  FeatureKey,
  PlanCode,
  RouteAccess,
  WorkspaceRole,
} from "@/lib/access/config";

/**
 * The one hook UI code calls to make permission decisions.
 * Automatically stays fresh across sign-in / sign-out (root
 * onAuthStateChange invalidates queries).
 */
export function useAccess() {
  const load = useServerFn(loadAccessContext);
  const { data } = useQuery({
    queryKey: ["access-context"],
    queryFn: () => load({}),
    staleTime: 60_000,
  });

  const ctx = data ?? ANONYMOUS_ACCESS;

  return useMemo(
    () => ({
      ctx,
      loading: !data,
      can: (spec: RouteAccess) => evaluate(ctx, spec).allowed,
      evaluate: (spec: RouteAccess) => evaluate(ctx, spec),
      hasRole: (role: WorkspaceRole) => _hasRole(ctx, role),
      hasPlan: (plan: PlanCode) => _hasPlan(ctx, plan),
      hasFeature: (f: FeatureKey) => _hasFeature(ctx, f),
    }),
    [ctx, data],
  );
}
