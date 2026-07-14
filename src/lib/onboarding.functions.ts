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
 * Atomic provisioning: organization + workspace + owner membership + 14-day
 * trial. Runs inside a single SECURITY DEFINER RPC so all three inserts share
 * one auth.uid() and one transaction. Removes the circular RLS dependency
 * that made sequential inserts fail with "new row violates row-level
 * security policy for table 'workspaces'".
 */
export const provisionTrialWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => provisionInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const orgSlug = `${slugify(data.organizationName)}-${randomSuffix()}`;
    const wsSlug = `${slugify(data.workspaceName)}-${randomSuffix()}`;

    const { data: rows, error } = await supabase.rpc("provision_trial_workspace", {
      _org_name: data.organizationName,
      _workspace_name: data.workspaceName,
      _org_slug: orgSlug,
      _workspace_slug: wsSlug,
      _trial_days: TRIAL_DAYS,
    });

    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.workspace_id) throw new Error("Could not create workspace.");

    return {
      workspaceId: row.workspace_id as string,
      alreadyExists: !!row.already_exists,
    };
  });
