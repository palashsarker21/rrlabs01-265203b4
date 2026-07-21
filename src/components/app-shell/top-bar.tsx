import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, LogOut, Plus, Search, Settings, Shield, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listAlerts } from "@/lib/notifications.functions";

interface Workspace {
  id: string;
  name: string;
  slug?: string | null;
  status?: string | null;
}

interface Profile {
  email?: string | null;
  display_name?: string | null;
}

export function TopBar({
  workspace,
  workspaces,
  profile,
  isSuperAdmin,
  onOpenSearch,
}: {
  workspace: Workspace | null;
  workspaces: Workspace[];
  profile: Profile | null;
  isSuperAdmin: boolean;
  onOpenSearch: () => void;
}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const alertsFn = useServerFn(listAlerts);
  const alertsQuery = useQuery({
    enabled: !!workspace,
    queryKey: ["alerts-open-count", workspace?.id],
    queryFn: () => alertsFn({ data: { workspaceId: workspace!.id, status: "open", limit: 1 } }),
    refetchInterval: 30000,
  });
  const openAlerts = alertsQuery.data?.openCount ?? 0;

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur md:px-4">
      <SidebarTrigger className="md:hidden" />

      <div className="hidden md:block">
        <WorkspaceMenu workspace={workspace} workspaces={workspaces} />
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSearch}
          className="hidden h-8 min-w-40 justify-start gap-2 px-2.5 text-xs text-muted-foreground sm:flex md:min-w-64"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">⌘K</kbd>
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenSearch} className="sm:hidden" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>

        <QuickCreateMenu />

        <Button asChild variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Link to="/notifications">
            <Bell className="h-4 w-4" />
            {openAlerts > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
                {openAlerts > 99 ? "99+" : openAlerts}
              </span>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="User menu">
              <div className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(profile?.display_name ?? profile?.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">
              {profile?.display_name ?? profile?.email ?? "Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings/security">
                <Shield className="mr-2 h-4 w-4" />
                Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/change-password">
                <User className="mr-2 h-4 w-4" />
                Change password
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/team">
                <Settings className="mr-2 h-4 w-4" />
                Workspace settings
              </Link>
            </DropdownMenuItem>
            {isSuperAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/platform">
                    <Shield className="mr-2 h-4 w-4" />
                    Platform Control Center
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} disabled={signingOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function WorkspaceMenu({
  workspace,
  workspaces,
}: {
  workspace: Workspace | null;
  workspaces: Workspace[];
}) {
  if (!workspace) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-sm font-medium">
          <div className="grid size-5 place-items-center rounded bg-primary/10 text-[10px] font-bold text-primary">
            {workspace.name.slice(0, 1).toUpperCase()}
          </div>
          <span className="max-w-40 truncate">{workspace.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} className="justify-between">
            <span className="truncate">{w.name}</span>
            {w.id === workspace.id && (
              <span className="text-[10px] uppercase text-primary">Active</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/onboarding">
            <Plus className="mr-2 h-4 w-4" />
            Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickCreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/integrations">Connect store</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/integrations">Connect payment</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/recovery-strategy">Configure AI strategy</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/team">Invite member</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/email/sandbox">Send test email</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/ai">Run AI test</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
