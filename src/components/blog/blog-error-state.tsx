import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";

interface BlogErrorStateProps {
  title: string;
  description: string;
  detail?: string;
  backLabel?: string;
}

export function BlogErrorState({
  title,
  description,
  detail,
  backLabel = "Back to the blog",
}: BlogErrorStateProps) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-3xl font-semibold text-foreground">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
      {detail && (
        <p className="mx-auto mt-3 max-w-xl rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {detail}
        </p>
      )}
      <Link
        to="/blog"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {backLabel}
      </Link>
    </main>
  );
}
