import type { PlanCode, WorkspaceRole } from "./config";

/** The full access snapshot for the current viewer. */
export interface AccessContext {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  workspaceId: string | null;
  workspaceRole: WorkspaceRole | null;
  planCode: PlanCode | null;
  planRank: number;
  subscriptionStatus: string | null;
  workspaceSuspended: boolean;
  maintenanceMode: boolean;
}

export const ANONYMOUS_ACCESS: AccessContext = {
  authenticated: false,
  userId: null,
  email: null,
  isSuperAdmin: false,
  isPlatformAdmin: false,
  workspaceId: null,
  workspaceRole: null,
  planCode: null,
  planRank: 0,
  subscriptionStatus: null,
  workspaceSuspended: false,
  maintenanceMode: false,
};
