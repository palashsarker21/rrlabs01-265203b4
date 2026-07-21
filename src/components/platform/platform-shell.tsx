import { useEffect } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { getMyAdminStatus } from "@/lib/admin.functions";
import { PlatformSidebar } from "./platform-sidebar";
import { PlatformTopBar } from "./platform-topbar";
import { SystemStatusBar } from "./system-status-bar";
import { PlatformCommandPalette } from "./command-palette";

const FOUNDER_EMAIL = "palashsarker1993@gmail.com";

/**
 * Enterprise Platform Control Center shell — a completely separate
 * application layer from the customer dashboard. Customer UI and
 * platform UI never share navigation.
 */
export function PlatformShell() {
  const navigate = useNavigate();
  const status = useServerFn(getMyAdminStatus);
  const { data: me, isLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status({}),
  });

  const { data: session } = useQuery({
    queryKey: ["me-email"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  useEffect(() => {
    if (!isLoading && me && !me.isSuperAdmin) {
      navigate({ to: "/app", replace: true });
    }
  }, [me, isLoading, navigate]);

  if (isLoading || !me) {
    return <div className="p-10 text-sm text-muted-foreground">Loading Platform Control Center…</div>;
  }
  if (!me.isSuperAdmin) return null;

  const founderMode = me.isSuperAdmin && session?.email?.toLowerCase() === FOUNDER_EMAIL;

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <PlatformCommandPalette founderMode={founderMode} />
      <PlatformSidebar founderMode={founderMode} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PlatformTopBar founderMode={founderMode} />
        <SystemStatusBar />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
