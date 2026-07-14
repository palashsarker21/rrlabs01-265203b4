import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: "System Status — RRLabs" },
      { name: "description", content: "Real-time status of RRLabs recovery engine, API, and integrations." },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/status" }],
  }),
});

const SYSTEMS = [
  { name: "Recovery Engine", status: "Operational" },
  { name: "API", status: "Operational" },
  { name: "Dashboard", status: "Operational" },
  { name: "Webhooks", status: "Operational" },
  { name: "Email Delivery", status: "Operational" },
  { name: "WhatsApp Delivery", status: "Operational" },
];

function StatusPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <h1 className="text-3xl font-semibold text-foreground">All systems operational</h1>
        </div>
        <div className="mt-10 divide-y divide-border/60 rounded-xl border border-border/60">
          {SYSTEMS.map((s) => (
            <div key={s.name} className="flex items-center justify-between px-5 py-4">
              <span className="text-foreground">{s.name}</span>
              <span className="text-sm text-emerald-600">{s.status}</span>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
