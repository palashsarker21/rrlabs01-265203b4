import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { AuthFooter } from "@/components/auth/auth-footer";

export const Route = createFileRoute("/session-expired")({
  component: SessionExpiredPage,
  head: () => ({
    meta: [
      { title: "Session expired — RRLabs" },
      { name: "description", content: "Your session has expired. Please sign in again." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SessionExpiredPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/60 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="mb-4 flex justify-center">
          <BrandMark size={40} />
        </div>
        <Clock className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Your session expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For your security, we&apos;ve signed you out after a period of inactivity. Sign in again
          to continue where you left off.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link to="/auth">
              <LogIn className="mr-1.5 h-3.5 w-3.5" />
              Sign in again
            </Link>
          </Button>
        </div>
        <AuthFooter />
      </div>
    </div>
  );
}
