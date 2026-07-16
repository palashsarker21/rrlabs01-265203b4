/**
 * iOSInstallHelp — floating help affordance for iOS Safari.
 *
 * iOS Safari never fires `beforeinstallprompt`, so the standard InstallPrompt
 * button cannot appear. This component detects iOS Safari (not already
 * standalone, not in an in-app browser) and surfaces a small "Install app"
 * button that opens a modal explaining the Share → Add to Home Screen flow.
 *
 * No business logic, no auth, no routing changes — purely presentational
 * guidance rendered alongside the existing InstallPrompt.
 */
import { useEffect, useState } from "react";
import { Share, Plus, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

const DISMISS_KEY = "rrlabs.pwa.ios.help.dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || ios);
}

/**
 * Detect iOS Safari (or iPadOS Safari desktop-mode). Excludes in-app
 * browsers (Facebook, Instagram, Gmail, TikTok, Line, etc.) and other
 * iOS browsers (Chrome/Firefox/Edge on iOS) because none of them can
 * add to the home screen via the Share sheet.
 */
function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const platform = (window.navigator as unknown as { platform?: string }).platform ?? "";
  const maxTouch = (window.navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;

  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac; disambiguate via touch points.
    (platform === "MacIntel" && maxTouch > 1);
  if (!isIos) return false;

  // Exclude non-Safari iOS browsers and in-app webviews.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/.test(ua)) return false;
  if (/FBAN|FBAV|Instagram|Line|Twitter|GSA|TikTok|Snapchat|Pinterest|LinkedInApp/.test(ua))
    return false;

  return /Safari/.test(ua);
}

export function IosInstallHelp() {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (!isIosSafari()) return;
    if (window.sessionStorage.getItem(DISMISS_KEY) === "1") return;
    setEligible(true);
  }, []);

  if (!eligible) return null;

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
    setEligible(false);
    setOpen(false);
  };

  return (
    <>
      {!open && (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur"
          role="region"
          aria-label={`Install ${BRAND.name} on iOS`}
        >
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Smartphone className="h-4 w-4" />
            Install {BRAND.name}
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install help"
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            Not now
          </button>
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-help-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ios-install-help-title" className="text-lg font-semibold">
                  Install {BRAND.name} on iPhone or iPad
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add {BRAND.name} to your Home Screen to launch it like an app — full screen, with
                  its own icon.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </span>
                <span>
                  Tap the <strong>Share</strong> icon{" "}
                  <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share icon" /> in
                  the Safari toolbar (bottom on iPhone, top on iPad).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  2
                </span>
                <span>
                  Scroll and choose <strong>Add to Home Screen</strong>{" "}
                  <Plus className="inline h-4 w-4 align-text-bottom" aria-label="Plus icon" />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  3
                </span>
                <span>
                  Confirm the name <strong>{BRAND.name}</strong> and tap <strong>Add</strong>. The
                  icon appears on your Home Screen.
                </span>
              </li>
            </ol>

            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Not seeing <em>Add to Home Screen</em>? Open this page in <strong>Safari</strong> (not
              Chrome, Firefox, or an in-app browser like Instagram or Gmail), then try again.
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-2"
              >
                Don't show again
              </button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
