import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listMyPermissions } from "./rbac.functions";
import type { PermissionKey } from "./permissions";

/**
 * Loads the current user's effective permission set for a workspace.
 * Cache is scoped by workspaceId — invalidate on role or override changes.
 */
export function usePermissions(workspaceId: string | null | undefined) {
  const fetcher = useServerFn(listMyPermissions);
  const query = useQuery({
    queryKey: ["rbac", "my-permissions", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) return { permissions: [] as string[] };
      return fetcher({ data: { workspaceId } });
    },
    staleTime: 60_000,
  });

  const set = useMemo(() => new Set(query.data?.permissions ?? []), [query.data]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    permissions: query.data?.permissions ?? [],
    has: (p: PermissionKey) => set.has(p),
    hasAny: (ps: PermissionKey[]) => ps.some((p) => set.has(p)),
    hasAll: (ps: PermissionKey[]) => ps.every((p) => set.has(p)),
    refetch: query.refetch,
  };
}
