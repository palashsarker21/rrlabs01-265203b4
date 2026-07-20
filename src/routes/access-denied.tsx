import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

const search = z.object({ reason: z.string().optional() });

export const Route = createFileRoute("/access-denied")({
  validateSearch: search,
  component: AccessDeniedPage,
  head: () => ({
    meta: [
      { title: "Access denied — RRLabs" },
      { name: "description", content: "You don't have permission to view this page." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AccessDeniedPage() {
  const { reason } = useSearch({ from: "/access-denied" });
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/60 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="mb-4 flex justify-center">
          <BrandMark size={40} />
        </div>
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {reason ??
            "You don't have permission to view this page. If you think this is a mistake, contact your workspace owner."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link to="/app">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to app
            </Link>
          </Button>
          <Button asChild>
            <Link to="/contact">Contact support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
