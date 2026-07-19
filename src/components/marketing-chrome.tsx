import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X, Mail, Phone, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/brand-mark";
import { SocialLinks } from "@/components/social-links";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BRAND, CONTACT } from "@/lib/brand";

const PRIMARY_NAV = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
  { to: "/docs", label: "Docs" },
  { to: "/faq", label: "FAQ" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

function useIsAuthed() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return authed;
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const authed = useIsAuthed();

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3.5">
        <Link to="/" className="shrink-0" aria-label={`${BRAND.name} home`}>
          <BrandLockup />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          {PRIMARY_NAV.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className="transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {i.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {authed ? (
            <Link to="/app">
              <Button size="sm">
                Dashboard
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/auth" search={{ redirect: "/checkout" }}>
                <Button size="sm">
                  Start Free Trial
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border/60 text-foreground lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden">
          <div className="border-t border-border/60 bg-background px-6 pb-8 pt-4">
            <nav className="flex flex-col divide-y divide-border/40">
              {PRIMARY_NAV.map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  onClick={() => setOpen(false)}
                  className="py-3 text-base text-foreground"
                >
                  {i.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-2">
              {authed ? (
                <Link to="/app" onClick={() => setOpen(false)}>
                  <Button className="w-full">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link
                    to="/auth"
                    search={{ redirect: "/checkout" }}
                    onClick={() => setOpen(false)}
                  >
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

type FooterItem = { label: string; to?: string; href?: string; badge?: string };

const FOOTER_COLS: { title: string; items: FooterItem[] }[] = [
  {
    title: "Company",
    items: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Blog", to: "/blog" },
    ],
  },
  {
    title: "Product",
    items: [
      { label: "Features", to: "/features" },
      { label: "Pricing", to: "/pricing" },
      { label: "Documentation", to: "/docs" },
      { label: "Integrations", href: "/integrations" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Help Center", to: "/faq" },
      { label: "Status", to: "/status" },
      { label: "API Documentation", href: "/docs/api" },
      { label: "Security", to: "/security" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Refund Policy", to: "/refund" },
      { label: "Cookie Policy", to: "/cookies" },
    ],
  },
];

export function MarketingFooter() {
  const { address } = CONTACT;
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <BrandLockup />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{BRAND.description}</p>
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <a
                href={`mailto:${CONTACT.supportEmail}`}
                className="flex items-center gap-2 hover:text-foreground"
              >
                <Mail className="h-4 w-4" /> {CONTACT.supportEmail}
              </a>
              {CONTACT.phones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p}`}
                  className="flex items-center gap-2 hover:text-foreground"
                >
                  <Phone className="h-4 w-4" /> {p}
                </a>
              ))}
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <address className="not-italic leading-relaxed">
                  {address.line1}
                  <br />
                  {address.line2}
                  <br />
                  {address.city}, {address.region} {address.postalCode ?? ""}
                  <br />
                  {address.country}
                </address>
              </div>
              <a
                href={CONTACT.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex hover:text-foreground"
              >
                {CONTACT.website}
              </a>
            </div>
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-foreground">Follow us</h4>
              <SocialLinks className="mt-3" ariaLabel="RRLabs on social media" />
            </div>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-foreground">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.items.map((i) => {
                  const content = (
                    <span className="inline-flex items-center gap-2">
                      {i.label}
                      {i.badge && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {i.badge}
                        </span>
                      )}
                    </span>
                  );
                  return (
                    <li key={i.label}>
                      {i.to ? (
                        <Link
                          to={i.to}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {content}
                        </Link>
                      ) : (
                        <a
                          href={i.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {content}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div>
            © {new Date().getFullYear()} {BRAND.legalOwner}. All Rights Reserved.
          </div>
          <div>Powered by RRLabs AI.</div>
        </div>
      </div>
    </footer>
  );
}
