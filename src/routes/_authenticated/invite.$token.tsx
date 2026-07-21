import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { acceptInvitation, previewInvitation } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/invite/$token")({
  head: () => ({
    meta: [{ title: "Accept your invitation — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useParams({ from: "/_authenticated/invite/$token" });
  const navigate = useNavigate();
  const previewFn = useServerFn(previewInvitation);
  const acceptFn = useServerFn(acceptInvitation);
  const [accepting, setAccepting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => previewFn({ data: { token } }),
  });

  async function accept() {
    setAccepting(true);
    try {
      await acceptFn({ data: { token } });
      toast.success("You've joined the workspace");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invite");
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <BrandLockup />
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full rounded-2xl border border-border/60 bg-card/40 p-8">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Looking up your invitation…</p>
          ) : error || !data ? (
            <>
              <h1 className="text-2xl font-bold">Invitation not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This invite link is invalid or has been revoked.
              </p>
              <Link to="/app">
                <Button className="mt-6">Go to dashboard</Button>
              </Link>
            </>
          ) : data.status !== "pending" ? (
            <>
              <h1 className="text-2xl font-bold">Invitation {data.status}</h1>
              <p className="mt-2 text-sm text-muted-foreground">This invite is no longer valid.</p>
              <Link to="/app">
                <Button className="mt-6">Go to dashboard</Button>
              </Link>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <h1 className="mt-3 text-2xl font-bold">You're invited</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Join <strong>{data.workspace_name}</strong>
                {data.organization_name ? ` at ${data.organization_name}` : ""} as{" "}
                <strong>{data.role}</strong>.
              </p>
              <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                Invited email: {data.email}
              </p>
              <Button className="mt-6" size="lg" onClick={accept} disabled={accepting}>
                {accepting ? "Joining…" : "Accept invitation"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">
                You must be signed in with {data.email} to accept.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
