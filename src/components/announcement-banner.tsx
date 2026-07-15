/**
 * Renders active site-wide announcement banners. Fetches from the public
 * server function (RLS filters to published + active + audience-safe rows).
 * Authenticated dismissals are persisted; anonymous dismissals live in
 * sessionStorage.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Info, ShieldAlert, X } from "lucide-react";

import {
  listActiveAnnouncements,
  listMyDismissals,
  dismissAnnouncement,
  type ActiveAnnouncement,
} from "@/lib/announcements.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rrl.announcement.dismissed";

function loadLocalDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveLocalDismissed(ids: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function AnnouncementBanner() {
  const list = useServerFn(listActiveAnnouncements);
  const myDismissals = useServerFn(listMyDismissals);
  const dismiss = useServerFn(dismissAnnouncement);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [localDismissed, setLocalDismissed] = useState<string[]>([]);

  useEffect(() => {
    setLocalDismissed(loadLocalDismissed());
    supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-active"],
    queryFn: () => list() as Promise<ActiveAnnouncement[]>,
    staleTime: 60_000,
  });

  const { data: dismissedRemote = [] } = useQuery({
    queryKey: ["announcements-my-dismissals", authed],
    queryFn: () => myDismissals() as Promise<string[]>,
    enabled: authed === true,
    staleTime: 60_000,
  });

  const dismissedSet = useMemo(
    () => new Set<string>([...dismissedRemote, ...localDismissed]),
    [dismissedRemote, localDismissed],
  );

  const banners = announcements.filter(
    (a) =>
      a.kind === "banner" &&
      !dismissedSet.has(a.id) &&
      (a.audience !== "authenticated" || authed === true) &&
      (a.audience !== "anonymous" || authed === false),
  );

  if (banners.length === 0) return null;

  async function handleDismiss(id: string) {
    if (authed) {
      try {
        await dismiss({ data: { announcementId: id } });
      } catch {
        /* fall through to local */
      }
    }
    const next = Array.from(new Set([...localDismissed, id]));
    setLocalDismissed(next);
    saveLocalDismissed(next);
  }

  return (
    <div className="w-full">
      {banners.map((a) => (
        <div
          key={a.id}
          role="status"
          className={cn(
            "flex items-start gap-3 border-b px-4 py-2 text-sm",
            a.severity === "critical" &&
              "border-destructive/40 bg-destructive/10 text-destructive-foreground",
            a.severity === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-100",
            a.severity === "info" && "border-primary/30 bg-primary/10 text-foreground",
          )}
        >
          <span aria-hidden className="mt-0.5">
            {a.severity === "critical" ? (
              <ShieldAlert className="size-4" />
            ) : a.severity === "warning" ? (
              <AlertTriangle className="size-4" />
            ) : (
              <Info className="size-4" />
            )}
          </span>
          <div className="flex-1">
            <div className="font-medium">{a.title}</div>
            {a.body && <div className="text-xs opacity-80">{a.body}</div>}
            {a.cta_label && a.cta_href && (
              <a
                href={a.cta_href}
                className="mt-1 inline-block text-xs font-medium underline underline-offset-2"
                rel="noopener noreferrer"
                target={a.cta_href.startsWith("http") ? "_blank" : undefined}
              >
                {a.cta_label}
              </a>
            )}
          </div>
          {a.dismissible && (
            <button
              type="button"
              onClick={() => void handleDismiss(a.id)}
              aria-label="Dismiss announcement"
              className="rounded-md p-1 hover:bg-foreground/10"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
