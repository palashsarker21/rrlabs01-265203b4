/**
 * Server-side plan-limit enforcement.
 *
 * Reads from provider_limits + workspace_feature_overrides via the
 * workspace_provider_limit SQL function. Super admins bypass.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProviderKind } from "./providers/kinds";
import { integrationKindFor } from "./providers/kinds";

export type EffectiveLimit = {
  kind: ProviderKind;
  used: number;
  max: number | null; // null = unlimited
};

export class PlanLimitError extends Error {
  code = "plan_limit_exceeded";
  status = 402;
  constructor(
    public kind: ProviderKind,
    public used: number,
    public max: number,
  ) {
    super(
      `Your plan allows ${max} ${kind}${max === 1 ? "" : "s"}. Upgrade to connect another.`,
    );
  }
}

export async function getEffectiveLimitsFor(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<EffectiveLimit[]> {
  const kinds: ProviderKind[] = ["store", "gateway", "email", "messaging"];
  const out: EffectiveLimit[] = [];
  for (const kind of kinds) {
    const { data: maxRaw } = await supabase.rpc("workspace_provider_limit", {
      _workspace_id: workspaceId,
      _kind: kind,
    });
    const max = typeof maxRaw === "number" ? maxRaw : null;
    const iKind = integrationKindFor(kind);
    // For email/messaging (both map to `communication`), we filter by the
    // set of provider codes owned by that kind. Read the catalog for that.
    const { data: providers } = await supabase
      .from("provider_catalog")
      .select("code")
      .eq("kind", kind);
    const codes = (providers ?? []).map((p) => p.code);
    let used = 0;
    if (codes.length) {
      const { count } = await supabase
        .from("integrations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("kind", iKind)
        .in("provider", codes)
        .eq("status", "connected");
      used = count ?? 0;
    }
    out.push({ kind, used, max });
  }
  return out;
}

export async function assertCanConnect(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  kind: ProviderKind,
  userId: string,
): Promise<void> {
  // Super-admin bypass.
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (isAdmin) return;

  const limits = await getEffectiveLimitsFor(supabase, workspaceId);
  const row = limits.find((l) => l.kind === kind);
  if (!row) return;
  if (row.max == null) return; // unlimited
  if (row.used >= row.max) {
    throw new PlanLimitError(kind, row.used, row.max);
  }
}
