# Access Control Layer

Centralized authorization for every route, server function, and UI
component in RRLabs. Do not implement page-level permission checks
individually — everything reads from this module.

## Modules

| File | Purpose |
| --- | --- |
| `config.ts` | Types, plan/role rank tables, `FEATURE_MIN_PLAN`, `ROUTE_REGISTRY` (single source of truth for every top-level route). |
| `types.ts` | `AccessContext` snapshot shape + `ANONYMOUS_ACCESS`. |
| `policy.ts` | Pure decision functions (`evaluate`, `hasRole`, `hasPlan`, `hasFeature`). Shared by client and server. |
| `context.functions.ts` | `loadAccessContext` server fn — assembles the viewer's `AccessContext` from Supabase. |
| `authorize.server.ts` | `authorize()` — the ONE backend gate used by every protected server function. Throws `AccessError`. |
| `nav.ts` | `buildNavigation(ctx)` — builds navigation from the registry, filtered by permission. |

## Client usage

```tsx
import { useAccess } from "@/hooks/use-access";
import { Can } from "@/components/access/Can";

// Inline gate
<Can feature="advanced_analytics" fallback={<UpgradeCTA />}>
  <AnalyticsPanel />
</Can>

// Programmatic
const { hasRole, hasFeature, ctx } = useAccess();
if (hasRole("admin")) { … }
```

Actions the viewer can't perform must be hidden or disabled — never
shown-then-errored. Use `<Can>` around delete buttons, admin nav,
billing settings, API-key management, workspace settings, etc.

## Server usage

Every `createServerFn` that touches workspace/plan/role state calls
`authorize()` after `requireSupabaseAuth`:

```ts
export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schema)
  .handler(async ({ data, context }) => {
    await authorize({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
      requiredRole: "manager",
      requiredFeature: "advanced_analytics", // optional
    });
    // … proceed
  });
```

Frontend checks are UX only. `authorize()` is the security boundary.

## SEO

- Public routes are marked `indexable: true` in `ROUTE_REGISTRY`.
- `sitemap.xml` and `robots.txt` derive the allow-list from the
  registry — private routes are excluded automatically.
- Private routes must set `<meta name="robots" content="noindex, nofollow">`
  in their `head()`. The constant `PRIVATE_ROBOTS_META` is provided.

## Error handling

`AccessDenied` component renders the correct screen from a `DenyReason`:

| Reason | UX |
| --- | --- |
| `unauthenticated` | Redirect / sign-in CTA |
| `forbidden` | Access denied |
| `wrong_workspace` | Workspace not found |
| `workspace_suspended` | Suspended screen |
| `upgrade_required` | Upgrade plan screen (deep-links to `/pricing`) |
| `maintenance` | Maintenance page |

## Adding a new route

1. Add an entry to `ROUTE_REGISTRY` in `config.ts`.
2. Place the file under `src/routes/_authenticated/` if it requires sign-in.
3. If it's server-driven, call `authorize()` inside every server fn it uses.
4. If a new feature flag is needed, add it to `FEATURE_MIN_PLAN`.

That's it — the sitemap, robots, nav, `<Can>`, and every guard update
automatically.
