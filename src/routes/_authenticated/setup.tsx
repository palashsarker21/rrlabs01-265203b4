import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/setup")({
  // The setup wizard has been replaced by the config-driven Integration
  // Center. All routes and buttons that used to point at /setup keep
  // working — this route just forwards.
  beforeLoad: () => {
    throw redirect({ to: "/integrations", replace: true });
  },
  component: () => null,
});
