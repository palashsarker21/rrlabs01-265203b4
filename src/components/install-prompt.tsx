/**
 * InstallPrompt — floating install button.
 *
 * Listens for `beforeinstallprompt` (Chrome/Edge/Samsung/Android) and shows
 * a button that triggers the deferred prompt. Hides on install, dismissal,
 * or when already running as a standalone PWA. iOS Safari does not fire
 * `beforeinstallprompt`; on iOS the button stays hidden (users install via
 * Share → Add to Home Screen per our verification checklist).
 */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "rrlabs.pwa.install.dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || ios);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (window.sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;

  const handleInstall = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "dismissed") {
        window.sessionStorage.setItem(DISMISS_KEY, "1");
      }
    } catch {
      // Prompt already used or blocked — hide either way.
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label={`Install ${BRAND.name}`}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      <Button size="sm" onClick={handleInstall} className="gap-1.5">
        <Download className="h-4 w-4" />
        Install {BRAND.name}
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="text-xs text-muted-foreground hover:text-foreground px-2"
      >
        Not now
      </button>
    </div>
  );
}
