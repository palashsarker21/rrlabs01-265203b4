import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { ADMIN_NAV, type AdminNavLeaf } from "@/lib/admin/nav";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function isActiveLeaf(leaf: AdminNavLeaf, pathname: string, searchTab?: string) {
  if (leaf.to !== "/admin") return pathname === leaf.to;
  // Legacy /admin?tab=<x>
  return pathname === "/admin" && searchTab === leaf.search?.tab;
}

export function AdminNavSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const searchTab = useRouterState({
    select: (r) => (r.location.search as { tab?: string })?.tab,
  });
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_NAV;
    return ADMIN_NAV.map((node) => {
      if (node.kind === "leaf") {
        return matchLeaf(node, q) ? node : null;
      }
      const items = node.items.filter((l) => matchLeaf(l, q));
      return items.length ? { ...node, items } : null;
    }).filter(Boolean) as typeof ADMIN_NAV;
  }, [query]);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-card/30 md:flex md:flex-col">
      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="h-9 pl-8"
            aria-label="Filter admin navigation"
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Press{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">⌘K</kbd> to
          open command palette
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Admin sections">
        <ul className="space-y-1">
          {filtered.map((node) => {
            if (node.kind === "leaf") {
              const active = isActiveLeaf(node, pathname, searchTab);
              const Icon = node.icon;
              return (
                <li key={node.id}>
                  <Link
                    to={node.to as never}
                    search={(node.search ?? {}) as never}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted",
                      active && "bg-primary/10 text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span>{node.label}</span>
                  </Link>
                </li>
              );
            }
            const open = query ? true : !collapsed[node.id];
            const GroupIcon = node.icon;
            return (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => setCollapsed((s) => ({ ...s, [node.id]: !collapsed[node.id] }))}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                >
                  <GroupIcon className="h-3.5 w-3.5" aria-hidden />
                  <span className="flex-1 text-left">{node.label}</span>
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")}
                    aria-hidden
                  />
                </button>
                {open && (
                  <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                    {node.items.map((leaf) => {
                      const active = isActiveLeaf(leaf, pathname, searchTab);
                      const Icon = leaf.icon;
                      return (
                        <li key={leaf.id}>
                          <Link
                            to={leaf.to as never}
                            search={(leaf.search ?? {}) as never}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted",
                              active && "bg-primary/10 text-primary",
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                            <span className="flex-1 truncate">{leaf.label}</span>
                            {leaf.badge ? (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {leaf.badge}
                              </span>
                            ) : null}
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

function matchLeaf(leaf: AdminNavLeaf, q: string) {
  const hay =
    `${leaf.label} ${leaf.keywords?.join(" ") ?? ""} ${leaf.description ?? ""}`.toLowerCase();
  return hay.includes(q);
}
