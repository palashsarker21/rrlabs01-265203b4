/**
 * Server-side usage enforcement.
 *
 * Every recovery-event ingestion path funnels through `assertWithinUsageLimit`.
 * The limit lives on `plans.monthly_event_limit` (NULL = unlimited).
 * Super-admin workspaces bypass the check; workspaces without an active plan
 * fall back to the Starter tier for a soft cap.
 *
 * Server-only — never import from client bundles.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export class UsageLimitError extends Error {
  status = 402 as const;
  code = "usage_limit_exceeded" as const;
  limit: number;
  used: number;
  planCode: string | null;
  constructor(planCode: string | null, limit: number, used: number) {
    super(
      `Monthly recovery event limit reached (${used}/${limit}) for ${planCode ?? "current"} plan. Upgrade to continue.`,
    );
    this.limit = limit;
    this.used = used;
    this.planCode = planCode;
  }
}

const FALLBACK_LIMIT = 500; // Starter tier

async function isSuperAdminOwner(workspaceId: string): Promise<boolean> {
  const { data: org } = await supabaseAdmin
    .from("workspaces")
    .select("organization_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!org?.organization_id) return false;
  const { data: ownerRow } = await supabaseAdmin
    .from("organizations")
    .select("owner_id")
    .eq("id", org.organization_id)
    .maybeSingle();
  const ownerId = ownerRow?.owner_id;
  if (!ownerId) return false;
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ownerId)
    .eq("role", "super_admin")
    .maybeSingle();
  return !!roleRow;
}

export type UsageSnapshot = {
  planCode: string | null;
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null;
  monthStart: string;
  bypass: boolean;
};

export async function getWorkspaceUsage(workspaceId: string): Promise<UsageSnapshot> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const startIso = monthStart.toISOString();

  const bypass = await isSuperAdminOwner(workspaceId);

  // Resolve the active plan via most recent subscription.
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan:plans(code, monthly_event_limit)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planCode = sub?.plan?.code ?? null;
  const limit = bypass
    ? null
    : (sub?.plan?.monthly_event_limit ?? FALLBACK_LIMIT);

  const { count } = await supabaseAdmin
    .from("recovery_events")
    .select("id", { head: true, count: "exact" })
    .eq("workspace_id", workspaceId)
    .gte("created_at", startIso);
  const used = count ?? 0;

  return {
    planCode,
    limit,
    used,
    remaining: limit == null ? null : Math.max(0, limit - used),
    monthStart: startIso,
    bypass,
  };
}

export async function assertWithinUsageLimit(workspaceId: string): Promise<UsageSnapshot> {
  const snap = await getWorkspaceUsage(workspaceId);
  if (snap.limit != null && snap.used >= snap.limit) {
    throw new UsageLimitError(snap.planCode, snap.limit, snap.used);
  }
  return snap;
}
