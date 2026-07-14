export type TrialInfo = {
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEndsAt: Date | null;
  hasActiveSubscription: boolean;
};

/**
 * Derive trial state from a workspace row.
 */
export function computeTrialInfo(
  ws:
    | {
        status: string | null;
        trial_ends_at: string | null;
        subscription_status: string | null;
      }
    | null
    | undefined,
): TrialInfo {
  if (!ws) {
    return {
      isTrial: false,
      isExpired: false,
      daysRemaining: 0,
      trialEndsAt: null,
      hasActiveSubscription: false,
    };
  }
  const hasActiveSubscription =
    ws.status === "active" &&
    (ws.subscription_status === "active" || ws.subscription_status === "on_trial");
  const trialEndsAt = ws.trial_ends_at ? new Date(ws.trial_ends_at) : null;
  const isTrial = ws.status === "trial";
  const now = Date.now();
  const msLeft = trialEndsAt ? trialEndsAt.getTime() - now : 0;
  const daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const isExpired = isTrial && trialEndsAt !== null && trialEndsAt.getTime() <= now;
  return { isTrial, isExpired, daysRemaining, trialEndsAt, hasActiveSubscription };
}

export function workspaceStateLabel(status: string | null | undefined): {
  label: string;
  tone: "info" | "success" | "warning" | "danger" | "muted";
} {
  switch (status) {
    case "trial":
      return { label: "Free Trial", tone: "info" };
    case "active":
      return { label: "Active", tone: "success" };
    case "expired":
      return { label: "Trial Expired", tone: "warning" };
    case "suspended":
      return { label: "Suspended", tone: "danger" };
    case "cancelled":
      return { label: "Cancelled", tone: "danger" };
    case "archived":
      return { label: "Archived", tone: "muted" };
    case "pending":
    case "setup":
      return { label: "Pending Setup", tone: "muted" };
    default:
      return { label: status ?? "Unknown", tone: "muted" };
  }
}
