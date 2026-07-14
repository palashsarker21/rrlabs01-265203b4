import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/slug";

const TRIAL_DAYS = 14;

const provisionInput = z.object({
  organizationName: z.string().trim().min(2).max(80),
  workspaceName: z.string().trim().min(2).max(80),
});

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Create an organization + workspace + owner membership for the signed-in
 * user and start a 14-day free trial. No payment required.
 */
export const provisionTrialWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => provisionInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    // If the user already has a workspace, don't create a new one.
    const { data: existing } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces:workspace_id(id, name, status, trial_ends_at)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing?.workspace_id) {
      return { workspaceId: existing.workspace_id, alreadyExists: true as const };
    }

    const orgSlug = `${slugify(data.organizationName)}-${randomSuffix()}`;
    const wsSlug = `${slugify(data.workspaceName)}-${randomSuffix()}`;
    const email = (claims as { email?: string }).email ?? null;

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        slug: orgSlug,
        name: data.organizationName,
        owner_id: userId,
        billing_email: email,
      })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Could not create organization.");

    const now = new Date();
    const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .insert({
        organization_id: org.id,
        slug: wsSlug,
        name: data.workspaceName,
        status: "trial",
        setup_step: 0,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        subscription_status: "trialing",
      })
      .select("id")
      .single();
    if (wsErr || !ws) throw new Error(wsErr?.message ?? "Could not create workspace.");

    const { error: memberErr } = await supabase.from("workspace_members").insert({
      workspace_id: ws.id,
      user_id: userId,
      role: "owner",
    });
    if (memberErr) throw new Error(memberErr.message);

    return { workspaceId: ws.id, alreadyExists: false as const };
  });
