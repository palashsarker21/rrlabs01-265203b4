/**
 * Super-admin RLS test suite runner. Invokes the database-side
 * public.run_rls_test_suite() which impersonates two synthetic users
 * in two synthetic workspaces and verifies cross-tenant RLS blocks
 * reads, writes, updates, and invites.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RlsTestResult = {
  test_name: string;
  passed: boolean;
  detail: string;
};

export const runRlsTestSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Forbidden: super admin only.");

    const { data, error } = await supabase.rpc("run_rls_test_suite");
    if (error) throw new Error(error.message);
    const results = (data ?? []) as RlsTestResult[];
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    return {
      ran_at: new Date().toISOString(),
      total: results.length,
      passed,
      failed,
      results,
    };
  });
