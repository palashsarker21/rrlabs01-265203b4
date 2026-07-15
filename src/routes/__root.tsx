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
import { BRAND, SITE_URL, LOGO, absoluteUrl } from "../lib/brand";
import { ErrorPage } from "../components/error-page";
import { ErrorBoundary } from "../components/error-boundary";
import { DebugErrorPanel } from "../components/debug-error-panel";
import { GlobalDebugOverlay } from "../components/global-debug-overlay";
import { isDebugMode } from "../lib/debug-mode";

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
      <DebugErrorPanel
        error={error}
        boundary="tanstack_root_error_component"
        onRetry={retry}
      />
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
      { name: "twitter:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "twitter:description", content: BRAND.description },
      { name: "twitter:image", content: absoluteUrl(LOGO.ogImage) },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "32x32", href: LOGO.icon32 },
      { rel: "icon", type: "image/png", sizes: "192x192", href: LOGO.icon192 },
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
              alternateName: BRAND.name,
              url: SITE_URL,
              logo: absoluteUrl(LOGO.full),
              email: "support@rrlabs.online",
              telephone: "+8801323405346",
              address: {
                "@type": "PostalAddress",
                streetAddress: "60, Chowhaddi, Dotto Kendua-7901",
                addressLocality: "Madaripur Sadar",
                addressRegion: "Dhaka",
                addressCountry: "BD",
              },
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: BRAND.name,
              publisher: { "@id": `${SITE_URL}/#organization` },
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

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary boundary="root_client_boundary">
        <Outlet />
      </ErrorBoundary>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
