import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Command, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { getMyAdminStatus } from "@/lib/admin.functions";
import { AdminNavSidebar } from "@/components/admin/v2/nav-sidebar";
import { AdminCommandPalette } from "@/components/admin/v2/command-palette";

export const Route = createFileRoute("/_authenticated/admin/v2")({
  component: AdminV2Layout,
  head: () => ({
    meta: [
      { title: "Platform Control Center — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminV2Layout() {
  const navigate = useNavigate();
  const status = useServerFn(getMyAdminStatus);
  const { data: me, isLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status({}),
  });

  useEffect(() => {
    if (!isLoading && me && !me.isSuperAdmin) {
      navigate({ to: "/app", replace: true });
    }
  }, [me, isLoading, navigate]);

  if (isLoading || !me) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!me.isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminCommandPalette />
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <BrandLockup />
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Shield className="mr-1 inline h-3 w-3" aria-hidden />
              Platform Control Center
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground md:inline-flex">
              <Command className="h-3 w-3" aria-hidden /> K
            </span>
            <Button asChild size="sm" variant="ghost">
              <Link to="/admin">Legacy console</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-56px)]">
        <AdminNavSidebar />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
