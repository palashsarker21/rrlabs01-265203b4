import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CreateAction = { label: string; to: string; search?: Record<string, string> };

const ACTIONS: CreateAction[] = [
  { label: "New Organization", to: "/admin", search: { tab: "workspaces" } },
  { label: "New User", to: "/admin", search: { tab: "users" } },
  { label: "New Feature Flag", to: "/admin", search: { tab: "features" } },
  { label: "New Coupon", to: "/admin", search: { tab: "pricing" } },
  { label: "New Pricing Plan", to: "/admin", search: { tab: "pricing" } },
  { label: "New Blog Post", to: "/admin", search: { tab: "blog" } },
  { label: "New Incident", to: "/admin", search: { tab: "incidents" } },
  { label: "New Announcement", to: "/admin", search: { tab: "announcements" } },
  { label: "New API Key", to: "/admin", search: { tab: "apikeys" } },
];

export function CreateMenu() {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden />
          Create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACTIONS.map((a) => (
          <DropdownMenuItem
            key={a.label}
            onSelect={() => navigate({ to: a.to as never, search: (a.search ?? {}) as never })}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
