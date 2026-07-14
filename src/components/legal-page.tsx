import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">{title}</h1>
      {updated && (
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      )}
      <div className="prose prose-neutral mt-10 max-w-none text-foreground/90">
        {children}
      </div>
    </main>
  );
}
