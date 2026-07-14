import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingHeader />
      <Outlet />
      <MarketingFooter />
    </div>
  );
}
