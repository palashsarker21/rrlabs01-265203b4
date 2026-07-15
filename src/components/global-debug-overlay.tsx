/**
 * GlobalDebugOverlay
 *
 * Client-only listener for uncaught runtime errors and unhandled promise
 * rejections that escape every React error boundary. Renders a fixed
 * bottom-right stack of debug panels so the user always sees the exact
 * root cause instead of a silent broken page.
 *
 * Active whenever `isDebugMode()` returns true (dev, or opt-in on prod
 * via `localStorage.rrlabs_debug=1`).
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DebugErrorPanel } from "./debug-error-panel";
import { isDebugMode } from "@/lib/debug-mode";

type Entry = { id: number; error: unknown; boundary: string };

let nextId = 1;

export function GlobalDebugOverlay() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isDebugMode());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const push = (error: unknown, boundary: string) => {
      console.error(`[RRLabs ${boundary}]`, error);
      setEntries((prev) => [...prev.slice(-4), { id: nextId++, error, boundary }]);
    };
    const onError = (event: ErrorEvent) => {
      push(event.error ?? new Error(event.message), "window.onerror");
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      push(event.reason, "unhandledrejection");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [enabled]);

  if (!enabled || entries.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-center gap-2 p-3">
      {entries.map((e) => (
        <div key={e.id} className="pointer-events-auto relative w-full max-w-3xl">
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
            className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <DebugErrorPanel error={e.error} boundary={e.boundary} />
        </div>
      ))}
    </div>
  );
}
