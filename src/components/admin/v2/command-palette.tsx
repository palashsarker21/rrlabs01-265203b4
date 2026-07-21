import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ADMIN_NAV } from "@/lib/admin/nav";

export function AdminCommandPalette() {
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
    // Use string navigation to keep the palette decoupled from typed routes.
    navigate({ to: to as never, search: (search ?? {}) as never });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a section, search commands…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {ADMIN_NAV.map((node) => {
          const items = node.kind === "leaf" ? [node] : node.items;
          const heading = node.kind === "leaf" ? "Overview" : node.label;
          return (
            <CommandGroup key={node.id} heading={heading}>
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
                    {leaf.badge ? (
                      <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {leaf.badge}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
        <CommandSeparator />
      </CommandList>
    </CommandDialog>
  );
}
