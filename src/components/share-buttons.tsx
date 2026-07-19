import { Linkedin, Twitter, Facebook, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/events";

interface ShareButtonsProps {
  url: string;
  title: string;
  /** Component tag emitted to analytics (e.g. "blog-post", "docs"). */
  component?: string;
  className?: string;
}

/**
 * Accessible share bar for public content pages. Emits `share_click` /
 * `share_copy_link` analytics events on every action.
 */
export function ShareButtons({ url, title, component = "share-bar", className }: ShareButtonsProps) {
  const encoded = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const targets = [
    {
      key: "linkedin",
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
      Icon: Linkedin,
    },
    {
      key: "x",
      label: "Share on X",
      href: `https://x.com/intent/tweet?url=${encoded}&text=${encTitle}`,
      Icon: Twitter,
    },
    {
      key: "facebook",
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      Icon: Facebook,
    },
    {
      key: "threads",
      label: "Share on Threads",
      href: `https://www.threads.net/intent/post?text=${encTitle}%20${encoded}`,
      // Threads SVG kept inline via a fallback icon to avoid new deps
      Icon: Twitter,
    },
  ] as const;

  const onShareClick = (platform: string) => () => {
    trackEvent("share_click", { component, platform });
  };

  const onCopyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      toast.success("Link copied.");
      trackEvent("share_copy_link", { component, platform: "clipboard" });
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <div
      role="group"
      aria-label="Share this page"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {targets.map(({ key, label, href, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onShareClick(key)}
          aria-label={`${label} (opens in a new tab)`}
          title={label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </a>
      ))}
      <button
        type="button"
        onClick={() => void onCopyLink()}
        aria-label="Copy link to this page"
        title="Copy link"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <LinkIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
