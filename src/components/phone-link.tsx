import { Copy, Phone as PhoneIcon, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { CONTACT_PHONES, type PhoneEntry } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/events";

interface PhoneLinkProps {
  entry: PhoneEntry;
  className?: string;
  linkClassName?: string;
}

async function copyToClipboard(value: string, kind: PhoneEntry["kind"]) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else if (typeof document !== "undefined") {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    toast.success("Phone number copied.");
    trackEvent("phone_copy", { component: "phone-link", platform: kind });
  } catch {
    toast.error("Could not copy phone number.");
  }
}

/**
 * Accessible, click-to-call phone number with copy-to-clipboard support.
 * Uses standard `tel:` URI so mobile devices open the dialer and long-press
 * offers native actions. Numbers remain selectable.
 */
export function PhoneLink({ entry, className, linkClassName }: PhoneLinkProps) {
  const Icon = entry.kind === "whatsapp" ? MessageCircle : PhoneIcon;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <a
        href={`tel:${entry.number}`}
        aria-label={entry.ariaLabel}
        onClick={() => trackEvent("phone_click", { component: "phone-link", platform: entry.kind })}
        className={cn(
          "inline-flex items-center gap-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          linkClassName,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="select-all tabular-nums">{entry.number}</span>
      </a>
      {entry.kind === "whatsapp" ? (
        <span
          className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
          aria-label="WhatsApp Business"
        >
          WhatsApp Business
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void copyToClipboard(entry.number, entry.kind)}
        aria-label={`Copy ${entry.number}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

interface PhoneListProps {
  className?: string;
  itemClassName?: string;
  linkClassName?: string;
}

export function PhoneList({ className, itemClassName, linkClassName }: PhoneListProps) {
  return (
    <ul className={cn("space-y-1", className)}>
      {CONTACT_PHONES.map((p) => (
        <li key={p.number}>
          <PhoneLink entry={p} className={itemClassName} linkClassName={linkClassName} />
        </li>
      ))}
    </ul>
  );
}
