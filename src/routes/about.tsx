import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — RRLabs" },
      {
        name: "description",
        content:
          "Revenue Recovery Labs builds AI infrastructure that helps subscription businesses stop losing money to failed payments.",
      },
      { property: "og:title", content: "About RRLabs" },
      { property: "og:description", content: "Why we're building the Recovery Engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingHeader />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Subscription revenue shouldn't leak.
        </h1>
        <div className="mt-8 space-y-5 text-base text-muted-foreground">
          <p>
            Between 5% and 15% of every recurring payment fails silently — expired cards, bank
            declines, 3DS challenges, insufficient funds. Most teams find out when a customer
            churns, and by then it's already too late.
          </p>
          <p>
            Revenue Recovery Labs builds the platform we wish we'd had: a live engine that listens
            to your payment provider, understands why each charge failed, writes copy in your voice,
            and follows up across email and WhatsApp until the customer actually pays.
          </p>
          <p>The Recovery Engine is the product. The marketing site is just how you find it.</p>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/auth" search={{ redirect: "/checkout" }}>
            <Button size="lg">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact-sales">
            <Button size="lg" variant="outline">
              Talk to Sales
            </Button>
          </Link>

        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
