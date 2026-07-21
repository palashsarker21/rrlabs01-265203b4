import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Play,
  Pause,
  Ban,
  Archive,
  RotateCcw,
  Clock,
  Zap,
  ZapOff,
  Pencil,
  StickyNote,
  ExternalLink,
  ShieldAlert,
  Copy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  setCustomerStatus,
  extendCustomerTrial,
  resetCustomerOnboarding,
  renameCustomer,
  logCustomerNote,
} from "@/lib/admin/customers.functions";
import { adminSetEngine } from "@/lib/admin.functions";

type Row = {
  workspace_id: string;
  workspace_name: string;
  status: string;
  recovery_engine_enabled: boolean;
};

export function ManageDropdown({ row, compact = false }: { row: Row; compact?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const setStatus = useServerFn(setCustomerStatus);
  const extendTrial = useServerFn(extendCustomerTrial);
  const resetOb = useServerFn(resetCustomerOnboarding);
  const rename = useServerFn(renameCustomer);
  const note = useServerFn(logCustomerNote);
  const setEngine = useServerFn(adminSetEngine);

  async function run(label: string, fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
      await qc.invalidateQueries({ queryKey: ["admin-customer", row.workspace_id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          {compact ? (
            <MoreHorizontal className="h-4 w-4" />
          ) : (
            <>
              Manage <MoreHorizontal className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Navigate</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            navigate({
              to: "/admin/v2/customers/$id",
              params: { id: row.workspace_id },
            })
          }
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Open details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(row.workspace_id);
            toast.success("Workspace ID copied");
          }}
        >
          <Copy className="mr-2 h-4 w-4" /> Copy workspace ID
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={row.status === "active"}
          onClick={() =>
            run("Activated", () =>
              setStatus({ data: { workspaceId: row.workspace_id, status: "active" } }),
            )
          }
        >
          <Play className="mr-2 h-4 w-4" /> Activate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={row.status === "paused"}
          onClick={() =>
            run("Paused", () =>
              setStatus({ data: { workspaceId: row.workspace_id, status: "paused" } }),
            )
          }
        >
          <Pause className="mr-2 h-4 w-4" /> Pause
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={row.status === "suspended"}
          onClick={() => {
            const reason = prompt("Reason for suspension?") ?? undefined;
            void run("Suspended", () =>
              setStatus({
                data: { workspaceId: row.workspace_id, status: "suspended", reason },
              }),
            );
          }}
        >
          <ShieldAlert className="mr-2 h-4 w-4" /> Suspend
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={row.status === "cancelled"}
          onClick={() => {
            if (!confirm("Cancel this workspace? Access will be revoked.")) return;
            void run("Cancelled", () =>
              setStatus({ data: { workspaceId: row.workspace_id, status: "cancelled" } }),
            );
          }}
        >
          <Ban className="mr-2 h-4 w-4" /> Cancel
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={row.status === "archived"}
          onClick={() => {
            if (!confirm("Archive this workspace? It will be hidden from lists.")) return;
            void run("Archived", () =>
              setStatus({ data: { workspaceId: row.workspace_id, status: "archived" } }),
            );
          }}
        >
          <Archive className="mr-2 h-4 w-4" /> Archive
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Engine</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={row.recovery_engine_enabled}
          onClick={() =>
            run("Recovery engine enabled", () =>
              setEngine({ data: { workspaceId: row.workspace_id, enabled: true } }),
            )
          }
        >
          <Zap className="mr-2 h-4 w-4" /> Enable engine
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!row.recovery_engine_enabled}
          onClick={() =>
            run("Recovery engine disabled", () =>
              setEngine({ data: { workspaceId: row.workspace_id, enabled: false } }),
            )
          }
        >
          <ZapOff className="mr-2 h-4 w-4" /> Disable engine
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Lifecycle</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            const raw = prompt("Extend trial by how many days?", "14");
            const days = Number(raw);
            if (!Number.isFinite(days) || days <= 0) return;
            void run(`Trial extended by ${days} days`, () =>
              extendTrial({ data: { workspaceId: row.workspace_id, days } }),
            );
          }}
        >
          <Clock className="mr-2 h-4 w-4" /> Extend trial
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (!confirm("Reset onboarding progress? User will restart setup.")) return;
            void run("Onboarding reset", () =>
              resetOb({ data: { workspaceId: row.workspace_id } }),
            );
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Reset onboarding
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const name = prompt("New workspace name?", row.workspace_name);
            if (!name || name === row.workspace_name) return;
            void run("Workspace renamed", () =>
              rename({ data: { workspaceId: row.workspace_id, name } }),
            );
          }}
        >
          <Pencil className="mr-2 h-4 w-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const n = prompt("Note to log against this workspace?");
            if (!n) return;
            void run("Note logged", () =>
              note({ data: { workspaceId: row.workspace_id, note: n } }),
            );
          }}
        >
          <StickyNote className="mr-2 h-4 w-4" /> Log note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
