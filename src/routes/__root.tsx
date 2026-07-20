import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "../integrations/supabase/client";
import {
  BRAND,
  SITE_URL,
  LOGO,
  absoluteUrl,
  SOCIAL_SAME_AS,
  CONTACT,
  CONTACT_PHONES,
} from "../lib/brand";

import { ErrorPage } from "../components/error-page";
import { ErrorBoundary } from "../components/error-boundary";
import { DebugErrorPanel } from "../components/debug-error-panel";
import { GlobalDebugOverlay } from "../components/global-debug-overlay";
import { AnnouncementBanner } from "../components/announcement-banner";
import { isDebugMode } from "../lib/debug-mode";
import { InstallPrompt } from "../components/install-prompt";
import { IosInstallHelp } from "../components/ios-install-help";
import { registerPwa } from "../lib/pwa-register";

function NotFoundComponent() {
  return <ErrorPage code={404} />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[RRLabs tanstack_root_error_component]", error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const retry = () => {
    router.invalidate();
    reset();
  };

  if (isDebugMode()) {
    return (
      <DebugErrorPanel error={error} boundary="tanstack_root_error_component" onRetry={retry} />
    );
  }

  return <ErrorPage code={500} onRetry={retry} />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0a1520" },
      { title: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "description", content: BRAND.description },
      { name: "author", content: BRAND.company },
      { name: "application-name", content: BRAND.name },
      { name: "apple-mobile-web-app-title", content: BRAND.name },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:site_name", content: BRAND.company },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { property: "og:description", content: BRAND.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: absoluteUrl(LOGO.ogImage) },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@rrlabsonline" },
      { name: "twitter:creator", content: "@rrlabsonline" },
      { name: "twitter:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "twitter:description", content: BRAND.description },
      { name: "twitter:image", content: absoluteUrl(LOGO.ogImage) },
      { title: "RRLabs — AI Revenue Recovery Platform for Subscription Businesses" },
      { property: "og:title", content: "RRLabs — AI Revenue Recovery Platform for Subscription Businesses" },
      { name: "twitter:title", content: "RRLabs — AI Revenue Recovery Platform for Subscription Businesses" },
      { name: "description", content: "RRLabs is an AI revenue recovery platform that automatically recovers failed subscription payments, reduces involuntary churn, and protects recurring revenue. Native Stripe, LemonSqueezy, and Paddle support." },
      { property: "og:description", content: "RRLabs is an AI revenue recovery platform that automatically recovers failed subscription payments, reduces involuntary churn, and protects recurring revenue. Native Stripe, LemonSqueezy, and Paddle support." },
      { name: "twitter:description", content: "RRLabs is an AI revenue recovery platform that automatically recovers failed subscription payments, reduces involuntary churn, and protects recurring revenue. Native Stripe, LemonSqueezy, and Paddle support." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/1Otdz8zaoeMOGuUNQdlbXbWzEbo2/social-images/social-1784299834952-RRLabs_logo_png.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/1Otdz8zaoeMOGuUNQdlbXbWzEbo2/social-images/social-1784299834952-RRLabs_logo_png.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "apple-touch-icon", sizes: "180x180", href: LOGO.icon180 },
      { rel: "mask-icon", href: LOGO.full, color: "#0a1520" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: `${BRAND.name} Blog RSS`,
        href: "/rss.xml",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: BRAND.company,
              legalName: BRAND.legalOwner,
              alternateName: BRAND.name,
              url: SITE_URL,
              logo: absoluteUrl(LOGO.full),
              image: absoluteUrl(LOGO.ogImage),
              description: BRAND.description,
              email: CONTACT.supportEmail,
              telephone: CONTACT_PHONES[0].number,
              serviceType: "Revenue Recovery SaaS",
              areaServed: "Worldwide",
              contactPoint: CONTACT_PHONES.map((p) => ({
                "@type": "ContactPoint",
                telephone: p.number,
                contactType:
                  p.kind === "whatsapp"
                    ? "customer support"
                    : p.kind === "primary"
                      ? "customer service"
                      : "customer support",
                availableLanguage: ["en", "bn"],
                ...(p.kind === "whatsapp"
                  ? {
                      contactOption: "HearingImpairedSupported",
                      description: "WhatsApp Business",
                    }
                  : {}),
              })),

              address: {
                "@type": "PostalAddress",
                streetAddress: "60, Chowhaddi, Dotto Kendua-7901",
                addressLocality: "Madaripur Sadar",
                addressRegion: "Dhaka",
                addressCountry: "BD",
              },
              sameAs: SOCIAL_SAME_AS,
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: BRAND.name,
              publisher: { "@id": `${SITE_URL}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/blog/search?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "SoftwareApplication",
              name: BRAND.name,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    void registerPwa();
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary boundary="root_client_boundary">
        <AnnouncementBanner />
        <Outlet />
      </ErrorBoundary>
      <GlobalDebugOverlay />
      <InstallPrompt />
      <IosInstallHelp />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
