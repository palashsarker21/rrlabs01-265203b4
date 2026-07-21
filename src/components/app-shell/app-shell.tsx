import { type ReactNode, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import { AppCommandPalette } from "./app-command-palette";
import { getMyAdminStatus } from "@/lib/admin.functions";

/**
 * Routes that render their own full-screen chrome and should bypass the
 * global authenticated shell (own header/sidebar or focused flows).
 */
const BYPASS_PREFIXES = ["/admin", "/platform", "/onboarding", "/invite", "/checkout"];

export function AuthenticatedShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const bypass = BYPASS_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (bypass) return <Outlet />;
  return <ShellChrome />;
}

function ShellChrome() {
  const [paletteKey, setPaletteKey] = useState(0);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      return { user: userData.user, profile: data };
    },
  });

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, slug, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const adminStatus = useServerFn(getMyAdminStatus);
  const { data: me } = useQuery({ queryKey: ["admin-status"], queryFn: () => adminStatus({}) });
  const isSuperAdmin = !!me?.isSuperAdmin;

  const activeWorkspace =
    workspaces?.find((w) => w.status === "active" || w.status === "trial") ?? workspaces?.[0] ?? null;

  // trigger opening command palette by dispatching a keyboard event
  const openSearch = () => {
    setPaletteKey((k) => k + 1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <SidebarProvider defaultOpen>
      <ShellLayout
        topBar={
          <TopBar
            workspace={activeWorkspace}
            workspaces={workspaces ?? []}
            profile={
              profile?.profile
                ? { email: profile.profile.email, display_name: profile.profile.display_name }
                : profile?.user
                  ? { email: profile.user.email }
                  : null
            }
            isSuperAdmin={isSuperAdmin}
            onOpenSearch={openSearch}
          />
        }
        sidebar={<AppSidebar isSuperAdmin={isSuperAdmin} />}
      >
        <Outlet />
      </ShellLayout>
      <AppCommandPalette key={paletteKey} isSuperAdmin={isSuperAdmin} />
    </SidebarProvider>
  );
}

function ShellLayout({
  topBar,
  sidebar,
  children,
}: {
  topBar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full bg-background">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topBar}
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
