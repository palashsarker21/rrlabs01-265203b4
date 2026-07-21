import { Link } from "@tanstack/react-router";
import { ArrowLeft, Command, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateMenu } from "./create-menu";

export function PlatformTopBar({ founderMode }: { founderMode: boolean }) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-card/40 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          <Shield className="mr-1 h-3 w-3" aria-hidden />
          Platform Control Center
        </span>
        {founderMode && (
          <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-500">
            Founder
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground md:inline-flex">
          <Command className="h-3 w-3" aria-hidden /> K
        </span>
        <CreateMenu />
        <Button asChild size="sm" variant="ghost">
          <Link to="/app">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Customer view
          </Link>
        </Button>
      </div>
    </header>
  );
}
