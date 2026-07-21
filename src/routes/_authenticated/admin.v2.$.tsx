import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy /admin/v2/* URLs — the Platform Control Center now lives at
// /platform. Redirect any remaining bookmarks to their canonical location.
export const Route = createFileRoute("/_authenticated/admin/v2/$")({
  beforeLoad: ({ params }) => {
    const rest = (params as { _splat?: string })._splat ?? "";
    throw redirect({ to: rest ? `/platform/${rest}` : "/platform", replace: true });
  },
  component: () => null,
});
