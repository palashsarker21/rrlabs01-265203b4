import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PLATFORM_NAV, type PlatformNavGroup } from "@/lib/platform/nav";
import { getPlatformBadges, type PlatformBadges } from "@/lib/platform/badges.functions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/brand-mark";

const STORAGE_KEY = "rrlabs.platform-nav.collapsed";

function loadCollapsed(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function badgeCount(badges: PlatformBadges | undefined, key?: string): number {
  if (!badges || !key) return 0;
  return (badges as unknown as Record<string, number>)[key] ?? 0;
}

export function PlatformSidebar({
  founderMode = false,
  collapsedRail = false,
}: {
  founderMode?: boolean;
  collapsedRail?: boolean;
}) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const searchTab = useRouterState({
    select: (r) => (r.location.search as { tab?: string })?.tab,
  });
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsed());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const badgesFn = useServerFn(getPlatformBadges);
  const { data: badges } = useQuery({
    queryKey: ["platform-badges"],
    queryFn: () => badgesFn({}),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const visible = useMemo<PlatformNavGroup[]>(() => {
    const q = query.trim().toLowerCase();
    return PLATFORM_NAV.map((g) => {
      const items = g.items
        .filter((i) => (i.godMode ? founderMode : true))
        .filter((i) => {
          if (!q) return true;
          const hay = `${i.label} ${i.keywords?.join(" ") ?? ""}`.toLowerCase();
          return hay.includes(q);
        });
      return items.length ? { ...g, items } : null;
    }).filter(Boolean) as PlatformNavGroup[];
  }, [query, founderMode]);

  const isActive = (leaf: { to: string; search?: Record<string, string> }) => {
    if (leaf.to === "/admin" && leaf.search?.tab) {
      return pathname === "/admin" && searchTab === leaf.search.tab;
    }
    return pathname === leaf.to;
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border/60 bg-card/30 md:flex",
        collapsedRail ? "w-14" : "w-64",
      )}
      aria-label="Platform navigation"
    >
      <div className="border-b border-border/60 p-3">
        {collapsedRail ? (
          <div className="mx-auto grid size-8 place-items-center rounded-md bg-primary/10 text-sm font-bold text-primary">
            R
          </div>
        ) : (
          <>
            <BrandLockup />
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="h-8 pl-8 text-xs"
                aria-label="Filter platform navigation"
              />
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {visible.map((group) => {
            const activeInGroup = group.items.some(isActive);
            const defaultCollapsed = !activeInGroup && group.id !== "overview";
            const isCollapsed = collapsed[group.id] ?? defaultCollapsed;
            const open = query ? true : !isCollapsed;
            const GroupIcon = group.icon;
            return (
              <li key={group.id}>
                {!collapsedRail && (
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((s) => ({ ...s, [group.id]: !isCollapsed }))
                    }
                    aria-expanded={open}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <GroupIcon className="h-3 w-3" aria-hidden />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")}
                      aria-hidden
                    />
                  </button>
                )}
                {(open || collapsedRail) && (
                  <ul className={cn("mt-0.5 space-y-0.5", !collapsedRail && "ml-2 border-l border-border/60 pl-2")}>
                    {group.items.map((leaf) => {
                      const active = isActive(leaf);
                      const Icon = leaf.icon;
                      const count = badgeCount(badges, leaf.badgeKey);
                      return (
                        <li key={leaf.id}>
                          <Link
                            to={leaf.to as never}
                            search={(leaf.search ?? {}) as never}
                            title={leaf.label}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted",
                              active && "bg-primary/10 text-primary",
                              collapsedRail && "justify-center px-0",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden />
                            {!collapsedRail && (
                              <>
                                <span className="flex-1 truncate">{leaf.label}</span>
                                {count > 0 && (
                                  <span
                                    className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                                    aria-label={`${count} pending`}
                                  >
                                    {count > 99 ? "99+" : count}
                                  </span>
                                )}
                              </>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
