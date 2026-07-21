import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { APP_NAV } from "@/lib/app-nav";

export function AppCommandPalette({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string, search?: Record<string, string>) => {
    setOpen(false);
    navigate({ to: to as never, search: (search ?? {}) as never });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to any page, feature, or setting…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {APP_NAV.map((group) => {
          const items = group.items.filter((i) => (isSuperAdmin ? true : !i.adminOnly));
          if (!items.length) return null;
          return (
            <CommandGroup key={group.id} heading={group.label}>
              {items.map((leaf) => {
                const Icon = leaf.icon;
                return (
                  <CommandItem
                    key={leaf.id}
                    value={`${leaf.label} ${leaf.keywords?.join(" ") ?? ""}`}
                    onSelect={() => go(leaf.to, leaf.search)}
                  >
                    <Icon className="mr-2 h-4 w-4" aria-hidden />
                    <span>{leaf.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
