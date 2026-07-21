/**
 * Support routing logic.
 *
 * Ladder for auto-assignment when a customer starts a conversation:
 *   support_agent → admin → moderator → super_admin
 *
 * Only staff currently marked `online` or `available` are eligible. If nobody
 * qualifies, the conversation is left unassigned (queued) and an auto-response
 * system message is posted.
 *
 * The database function `next_support_assignee()` implements the same ladder
 * server-side using presence + current load. This module contains a pure JS
 * implementation used for unit tests and any client-side reasoning.
 */

export type StaffRole = "support_agent" | "admin" | "moderator" | "super_admin";
export type PresenceStatus = "online" | "available" | "busy" | "away" | "offline";

export interface StaffCandidate {
  userId: string;
  role: StaffRole;
  status: PresenceStatus;
  /** Current number of open conversations already assigned to this user. */
  load: number;
}

const ROLE_RANK: Record<StaffRole, number> = {
  support_agent: 1,
  admin: 2,
  moderator: 3,
  super_admin: 4,
};

const AVAILABLE: ReadonlySet<PresenceStatus> = new Set<PresenceStatus>(["online", "available"]);

/**
 * Pick the next assignee following the priority ladder.
 * Returns `null` when nobody eligible is online → the conversation is queued.
 */
export function pickNextAssignee(candidates: readonly StaffCandidate[]): StaffCandidate | null {
  const eligible = candidates.filter((c) => AVAILABLE.has(c.status));
  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    const rankDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role];
    if (rankDiff !== 0) return rankDiff;
    const loadDiff = a.load - b.load;
    if (loadDiff !== 0) return loadDiff;
    return a.userId.localeCompare(b.userId);
  });

  return sorted[0] ?? null;
}

export const SUPPORT_ROLE_RANK = ROLE_RANK;
export const AVAILABLE_PRESENCE = AVAILABLE;
