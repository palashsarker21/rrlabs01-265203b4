import type { ReactNode } from "react";
import { usePermissions } from "./use-permissions";
import type { PermissionKey } from "./permissions";

interface GuardProps {
  workspaceId: string | null | undefined;
  /** Require at least one of these permissions. */
  anyOf?: PermissionKey[];
  /** Require all of these permissions. */
  allOf?: PermissionKey[];
  /** Rendered while the permission set is loading. */
  loading?: ReactNode;
  /** Rendered when access is denied. Defaults to null (hide). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Client-side gate. Never rely on this alone — server + DB enforce access.
 * Use it to hide/disable UI affordances the user can't act on.
 */
export function Guard({
  workspaceId,
  anyOf,
  allOf,
  loading = null,
  fallback = null,
  children,
}: GuardProps) {
  const { isLoading, has, hasAny, hasAll } = usePermissions(workspaceId);
  if (isLoading) return <>{loading}</>;

  const ok =
    (!anyOf || anyOf.length === 0 || hasAny(anyOf)) &&
    (!allOf || allOf.length === 0 || hasAll(allOf)) &&
    (anyOf || allOf ? true : false);

  // If neither anyOf nor allOf provided, treat as "any authenticated" — allow.
  const anySpecified = (anyOf && anyOf.length) || (allOf && allOf.length);
  if (!anySpecified) return <>{children}</>;

  return <>{ok ? children : fallback}</>;
}

export function IfPermission({
  workspaceId,
  permission,
  children,
  fallback = null,
}: {
  workspaceId: string | null | undefined;
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isLoading, has } = usePermissions(workspaceId);
  if (isLoading) return null;
  return <>{has(permission) ? children : fallback}</>;
}
