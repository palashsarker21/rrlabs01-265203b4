import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  Ban,
  Clock,
  HelpCircle,
  Lock,
  ShieldAlert,
  Wrench,
  XCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { CONTACT } from "@/lib/brand";

export type ErrorPageCode = 400 | 401 | 403 | 404 | 429 | 500 | 503 | "maintenance";

const MAP: Record<
  string,
  { title: string; message: string; icon: ComponentType<{ className?: string }> }
> = {
  "400": {
    title: "Bad request",
    message: "The request looked malformed. Please review the form and try again.",
    icon: XCircle,
  },
  "401": {
    title: "You need to sign in",
    message: "Your session ended or you aren't signed in. Sign in to continue.",
    icon: Lock,
  },
  "403": {
    title: "You don't have access",
    message: "This resource is restricted to specific workspaces, roles, or plans.",
    icon: ShieldAlert,
  },
  "404": {
    title: "Page not found",
    message: "The page you're looking for doesn't exist or has been moved.",
    icon: HelpCircle,
  },
  "429": {
    title: "Too many requests",
    message: "You've hit a rate limit. Wait a moment and try again.",
    icon: Clock,
  },
  "500": {
    title: "Something went wrong",
    message: "An unexpected error happened on our end. It has been logged and we're on it.",
    icon: AlertOctagon,
  },
  "503": {
    title: "Service temporarily unavailable",
    message: "A service we depend on is currently unreachable. Please retry shortly.",
    icon: Ban,
  },
  maintenance: {
    title: "We're doing quick maintenance",
    message: "RRLabs is briefly offline while we ship an update. Come back in a few minutes.",
    icon: Wrench,
  },
};

export function ErrorPage({
  code,
  title: overrideTitle,
  message: overrideMessage,
  onRetry,
  chrome = true,
}: {
  code: ErrorPageCode;
  title?: string;
  message?: string;
  onRetry?: () => void;
  chrome?: boolean;
}) {
  const key = String(code);
  const entry = MAP[key] ?? MAP["500"];
  const Icon = entry.icon;
  const title = overrideTitle ?? entry.title;
  const message = overrideMessage ?? entry.message;
  const codeLabel = typeof code === "number" ? code : "MAINTENANCE";

  const body = (
    <main role="alert" className="flex min-h-[60vh] items-center justify-center px-6 py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Icon className="h-6 w-6" />
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Error {codeLabel}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onRetry && <Button onClick={onRetry}>Try again</Button>}
          <Link to="/">
            <Button variant={onRetry ? "outline" : "default"}>Return home</Button>
          </Link>
          <a href={`mailto:${CONTACT.supportEmail}`}>
            <Button variant="ghost">Contact support</Button>
          </a>
        </div>
      </div>
    </main>
  );

  if (!chrome) return body;
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      {body}
      <MarketingFooter />
    </div>
  );
}
