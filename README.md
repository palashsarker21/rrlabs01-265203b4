# Revenue Recovery Labs (RRLabs)

AI-powered payment recovery for subscription businesses. Listens to your payment provider, understands why each charge failed, and follows up across email and WhatsApp on a multi-touch cadence until customers pay.

## Features

- **Gemini-powered failure analysis** via the Lovable AI Gateway
- **Multi-touch cadence** — 0h, +1d, +3d, +7d follow-ups with per-workspace template overrides
- **Email + WhatsApp dispatch** (Resend + Meta WhatsApp Cloud API)
- **Live dashboard** — recovered revenue, recovery rate, at-risk amounts, event stream
- **Multi-tenant** — organizations, workspaces, role-scoped RLS
- **Encrypted credentials** — AES-256-GCM at rest
- **Audit log** — every sensitive action (integrations, activations, retries) captured
- **Admin console** — tenant-wide oversight and engine controls for super admins

## Tech stack

- **Framework**: TanStack Start v1 (React 19, SSR, server functions)
- **Build**: Vite 7
- **Styling**: Tailwind CSS v4 (`src/styles.css`) + shadcn/ui
- **Backend**: Lovable Cloud (Supabase — Postgres, Auth, RLS, pg_cron, pg_net)
- **AI**: Lovable AI Gateway (Gemini)
- **Payments**: Stripe webhooks + Lemon Squeezy billing
- **Deployment**: Cloudflare Workers (edge)

## Project structure

```
src/
├── routes/                     File-based routing (TanStack Router)
│   ├── __root.tsx              App shell + sitewide head metadata
│   ├── index.tsx               Landing page
│   ├── features.tsx            Marketing
│   ├── pricing.tsx
│   ├── docs.tsx
│   ├── about.tsx
│   ├── contact.tsx
│   ├── auth.tsx                Sign-in / sign-up
│   ├── sitemap[.]xml.ts        Dynamic sitemap
│   ├── _authenticated/         Gated app subtree
│   │   ├── app.tsx             Dashboard
│   │   ├── admin.tsx           Super-admin console
│   │   ├── setup.tsx           Integration wizard
│   │   └── checkout.tsx
│   └── api/public/             Public HTTP endpoints (webhooks, cron)
│       ├── webhooks/stripe.ts
│       ├── webhooks/lemonsqueezy.ts
│       └── hooks/recovery-cadence.ts
├── lib/
│   ├── *.functions.ts          Client-callable server functions
│   ├── *.server.ts             Server-only helpers
│   ├── integrations/           Adapter registry + catalog
│   └── recovery/               Engine + dispatch
├── components/                 UI + shadcn primitives
├── integrations/supabase/      Generated Supabase clients (do not edit)
└── styles.css                  Tailwind v4 theme

supabase/migrations/            Database schema + RLS
public/                         Static assets (favicon, robots.txt)
```

## Data model (public schema)

| Table | Purpose |
| --- | --- |
| `profiles` | User profile, linked to `auth.users` |
| `user_roles` | Role assignments (separate table — prevents privilege escalation) |
| `organizations` | Top-level tenant |
| `workspaces` | Recovery engine scope (integrations, events, templates) |
| `workspace_members` | Membership + role per workspace |
| `integrations` | Connected providers (Stripe, Resend, WhatsApp) with encrypted secrets |
| `recovery_events` | Failed payments + cadence state (`cadence_step`, `next_run_at`) |
| `recovery_templates` | Manager overrides per step + channel |
| `audit_logs` | Immutable action trail |

Every table enforces **row-level security**. Grants are declared in the same migration as the table.

## Recovery engine flow

1. Stripe webhook (`payment_intent.payment_failed`, `invoice.payment_failed`, …) hits `/api/public/webhooks/stripe?w=<workspace_id>`; signature verified per workspace.
2. Engine inserts a `recovery_events` row and calls Gemini via the AI Gateway to classify the failure and draft copy.
3. Dispatcher sends the message via Resend / WhatsApp, records provider IDs and delivery state.
4. `pg_cron` pings `/api/public/hooks/recovery-cadence` every 15 minutes; due events advance to the next cadence step (0h → +1d → +3d → +7d → auto-abandon).
5. `payment_intent.succeeded` / `invoice.payment_succeeded` closes the event as recovered.

## Environment

Managed via Lovable Cloud. Non-secret:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Secrets (server-only, stored in the platform secret manager):

- `SUPABASE_SERVICE_ROLE_KEY` — admin client
- `INTEGRATION_ENCRYPTION_KEY` — AES-256-GCM key for `integrations.secrets`
- `STRIPE_WEBHOOK_SECRET_DEFAULT` — fallback signature secret (per-workspace secrets live in `integrations`)
- `LOVABLE_API_KEY` — AI Gateway
- `LEMONSQUEEZY_WEBHOOK_SECRET`

## Development

```bash
bun install
bun dev              # start dev server (http://localhost:8080)
bunx tsgo --noEmit   # typecheck
```

Database changes are applied via Supabase migrations under `supabase/migrations/`. Do not edit generated files (`src/integrations/supabase/*`, `src/routeTree.gen.ts`).

## Deployment

Publish from the Lovable dashboard. Published sites run on Cloudflare Workers (edge). External services (Stripe, pg_cron) should use the stable URL:

```
https://project--<project-id>.lovable.app
```

## SEO

- Per-route `head()` metadata (title, description, `og:*`, `twitter:card`)
- Dynamic sitemap at `/sitemap.xml`
- `robots.txt` allows the marketing surface, blocks authenticated + API routes
- JSON-LD is added on leaf routes where relevant

## Security highlights

- Roles stored in `user_roles` (never on `profiles`); checked via `has_role()` SECURITY DEFINER function
- Every `public` table: `GRANT` block + `ENABLE ROW LEVEL SECURITY` + policies
- Webhook handlers verify HMAC signatures before touching data
- Integration credentials AES-256-GCM encrypted; never returned to the browser
- Audit log written from server-only code with actor + IP + UA

## License

Proprietary — © Revenue Recovery Labs.
