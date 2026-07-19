import { Facebook, Github, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { ENABLED_SOCIAL_PROFILES, type SocialPlatform, type SocialProfile } from "@/lib/brand";

/**
 * Threads has no Lucide icon yet — inline the official monochrome glyph.
 * Uses currentColor so it inherits from `text-*` utilities like the Lucide
 * icons around it.
 */
function ThreadsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.02c.028-3.576.878-6.43 2.523-8.482C5.845 1.205 8.598.024 12.179 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.312-6.015-2.91.022-5.11.936-6.54 2.717-1.34 1.664-2.03 4.07-2.058 7.152.028 3.082.72 5.488 2.058 7.152 1.43 1.783 3.63 2.696 6.54 2.717 2.625-.02 4.362-.658 5.808-2.114 1.647-1.66 1.618-3.7 1.09-4.918-.31-.716-.873-1.31-1.634-1.75-.192 1.352-.622 2.446-1.29 3.272-.895 1.107-2.164 1.712-3.77 1.797-1.216.065-2.387-.223-3.297-.812-1.075-.696-1.706-1.76-1.774-2.997-.14-2.539 1.86-4.362 4.978-4.54.917-.052 1.775-.011 2.552.121-.075-.632-.29-1.113-.65-1.437-.5-.451-1.216-.679-2.133-.679h-.028c-1.144.017-2.243.417-3.09 1.126l-1.208-1.804c1.209-1.001 2.706-1.552 4.276-1.575h.048c2.618 0 4.152 1.61 4.304 4.404.087.05.174.102.26.157.926.582 1.632 1.412 2.037 2.401.567 1.387.618 3.664-1.288 5.586C17.72 22.97 15.484 24 12.186 24zm.038-11.386c-.216 0-.436.006-.66.02-2.096.118-3.156 1.024-3.083 2.377.098 1.78 2.05 2.011 2.965 1.962.995-.053 2.647-.442 2.955-3.795a10.16 10.16 0 0 0-2.177-.264z" />
    </svg>
  );
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

const PLATFORM_ICON: Record<SocialPlatform, IconComponent | null> = {
  github: Github,
  linkedin: Linkedin,
  x: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  threads: ThreadsIcon,
  youtube: Youtube,
  // Reserved — no icon shipped yet.
  producthunt: null,
  crunchbase: null,
  g2: null,
  capterra: null,
  devto: null,
  hashnode: null,
  medium: null,
};

export interface SocialLinksProps {
  /** Visual variant. */
  variant?: "icons" | "list";
  /** Optional filter: render only these platforms (in the given order). */
  platforms?: readonly SocialPlatform[];
  /** Extra className applied to the container. */
  className?: string;
  /** Accessible name for the whole group. */
  ariaLabel?: string;
}

function getVisibleProfiles(filter?: readonly SocialPlatform[]): SocialProfile[] {
  const enabled = ENABLED_SOCIAL_PROFILES.filter((p) => PLATFORM_ICON[p.platform]);
  if (!filter?.length) return enabled;
  const map = new Map(enabled.map((p) => [p.platform, p]));
  return filter.map((k) => map.get(k)).filter((p): p is SocialProfile => Boolean(p));
}

/**
 * Reusable social profile block. Two variants:
 *  - `icons` (default): compact icon row, used in headers/footers.
 *  - `list`: icon + platform name + URL, used on Contact / About.
 *
 * All links open in a new tab with `rel="noopener noreferrer"` and expose
 * an aria-label + visually-hidden text for screen readers. Focus styles use
 * the design-system ring token so keyboard users get a visible indicator.
 */
export function SocialLinks({
  variant = "icons",
  platforms,
  className,
  ariaLabel = "Official social profiles",
}: SocialLinksProps) {
  const profiles = getVisibleProfiles(platforms);
  if (profiles.length === 0) return null;

  if (variant === "list") {
    return (
      <ul
        aria-label={ariaLabel}
        className={cn("grid gap-2 sm:grid-cols-2", className)}
      >
        {profiles.map((p) => {
          const Icon = PLATFORM_ICON[p.platform]!;
          return (
            <li key={p.platform}>
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                title={`${p.label} — opens in a new tab`}
                aria-label={`${p.label} (opens in a new tab)`}
                className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3 text-sm text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-foreground">{p.label}</span>
                  <span className="truncate text-xs">{p.href.replace(/^https?:\/\//, "")}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-3", className)}
    >
      {profiles.map((p) => {
        const Icon = PLATFORM_ICON[p.platform]!;
        return (
          <li key={p.platform}>
            <a
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`${p.label} — opens in a new tab`}
              aria-label={`${p.label} (opens in a new tab)`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{p.label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
