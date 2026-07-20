import { Link } from "@tanstack/react-router";

/** Compliance / trust footer rendered on every auth page. */
export function AuthFooter({ className }: { className?: string }) {
  const links: Array<{ to: string; label: string }> = [
    { to: "/terms", label: "Terms" },
    { to: "/privacy", label: "Privacy" },
    { to: "/cookies", label: "Cookies" },
    { to: "/security", label: "Trust Center" },
    { to: "/contact", label: "Contact" },
  ];
  return (
    <nav
      aria-label="Legal and support links"
      className={
        "mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground " +
        (className ?? "")
      }
    >
      {links.map((l, i) => (
        <span key={l.to} className="flex items-center gap-4">
          <Link
            to={l.to}
            className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {l.label}
          </Link>
          {i < links.length - 1 && <span aria-hidden>·</span>}
        </span>
      ))}
    </nav>
  );
}
