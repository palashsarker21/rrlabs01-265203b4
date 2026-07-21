import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";

import { APP_NAV, type AppNavGroup } from "@/lib/app-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrandLockup } from "@/components/brand-mark";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rrlabs.app-nav.collapsed";

function loadCollapsed(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function AppSidebar({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const { state } = useSidebar();
  const collapsedRail = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsed());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const visibleGroups = useMemo<AppNavGroup[]>(() => {
    const q = query.trim().toLowerCase();
    return APP_NAV.map((g) => {
      const items = g.items
        .filter((i) => (isSuperAdmin ? true : !i.adminOnly))
        .filter((i) => {
          if (!q) return true;
          const hay = `${i.label} ${i.keywords?.join(" ") ?? ""}`.toLowerCase();
          return hay.includes(q);
        });
      return items.length ? { ...g, items } : null;
    }).filter(Boolean) as AppNavGroup[];
  }, [query, isSuperAdmin]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/60">
        <div className={cn("flex items-center gap-2 px-2 py-1.5", collapsedRail && "justify-center")}>
          {collapsedRail ? (
            <div className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary text-xs font-bold">
              R
            </div>
          ) : (
            <BrandLockup />
          )}
        </div>
        {!collapsedRail && (
          <div className="relative px-2 pb-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="h-8 pl-7 text-xs"
              aria-label="Filter navigation"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => {
          const activeInGroup = group.items.some((i) => i.to === pathname);
          const defaultCollapsed =
            !activeInGroup && group.id !== "dashboard" && group.id !== "recovery";
          const isCollapsed = collapsed[group.id] ?? defaultCollapsed;
          const open = query ? true : !isCollapsed;
          const GroupIcon = group.icon;
          return (
            <SidebarGroup key={group.id}>
              {!collapsedRail && (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((s) => ({ ...s, [group.id]: !(collapsed[group.id] ?? false) ? true : false }))
                  }
                  aria-expanded={open}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <GroupIcon className="h-3 w-3" aria-hidden />
                  <SidebarGroupLabel className="flex-1 text-left p-0 h-auto text-[10px]">
                    {group.label}
                  </SidebarGroupLabel>
                  <ChevronDown
                    className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")}
                    aria-hidden
                  />
                </button>
              )}
              {(open || collapsedRail) && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((leaf) => {
                      const Icon = leaf.icon;
                      const active = leaf.to === pathname;
                      return (
                        <SidebarMenuItem key={leaf.id}>
                          <SidebarMenuButton asChild isActive={active} tooltip={leaf.label}>
                            <Link
                              to={leaf.to as never}
                              search={(leaf.search ?? {}) as never}
                              className="flex items-center gap-2"
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden />
                              <span className="truncate">{leaf.label}</span>
                              {leaf.badge && (
                                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                                  {leaf.badge}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {!collapsedRail && (
        <SidebarFooter className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
          Press{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[9px]">⌘K</kbd> for
          search
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
