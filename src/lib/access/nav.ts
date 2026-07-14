import { ROUTE_REGISTRY, type RouteAccess } from "./config";
import { evaluate } from "./policy";
import type { AccessContext } from "./types";

export interface NavItem {
  path: string;
  label: string;
  group: NonNullable<RouteAccess["navGroup"]>;
}

/**
 * Builds navigation strictly from the route registry, filtered by
 * what the current viewer can access. Never surface a link the
 * user can't open.
 */
export function buildNavigation(ctx: AccessContext): NavItem[] {
  return ROUTE_REGISTRY.filter((r) => r.navGroup && r.label)
    .filter((r) => evaluate(ctx, r).allowed)
    .map((r) => ({ path: r.path, label: r.label!, group: r.navGroup! }));
}
