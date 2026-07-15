
# Pricing System Redesign — RRLabs

## 1. Database (migration)

- Add `success_fee_bps INT` column to `plans` (basis points; 300 = 3%).
- Add `is_contact_sales BOOLEAN DEFAULT false` and `starting_at_price_cents INT` for Enterprise.
- Upsert 4 canonical plan rows by `code`:
  - `starter` — $29, 300 bps, LS variant from `LEMONSQUEEZY_VARIANT_STARTER`
  - `growth` — $99, 250 bps, LS variant from `LEMONSQUEEZY_VARIANT_GROWTH` (MOST POPULAR)
  - `business` — $299, 200 bps, LS variant from new `LEMONSQUEEZY_VARIANT_BUSINESS`
  - `enterprise` — starting $999, 200 bps, `is_contact_sales=true`, no LS variant
- Retire `scale` code (soft: set `is_active=false`).
- Create `contact_leads` table (name, email, company, seats, arr_range, use_case, source, created_at) with RLS: insert-anon-allowed, select service_role/super_admin only. GRANTs included.

## 2. New `LEMONSQUEEZY_VARIANT_BUSINESS` secret

Request via `add_secret`. Until set, Business CTA renders **"Coming Soon"** and is disabled per spec.

## 3. Centralized config

- `src/lib/pricing.ts` — SSOT for **display** (copy, features, badges, CTA labels, comparison-table matrix, FAQ, success-fee %, trust badges).
  - `type Plan`, `PLANS: Plan[]`, `getPlanByCode`, `formatSuccessFee`, `TRIAL_DAYS=14`.
- `src/lib/billing.ts` — client-side CTA routing helper:
  - `resolveCta({ planCode, session, subscription })` → `{ kind: "signup" | "checkout" | "manage" | "contact_sales" | "coming_soon", href }`.
  - Uses existing `createCheckoutSession` server fn for Starter/Growth/Business; routes Enterprise → `/contact-sales?plan=enterprise`; routes unauthenticated → `/auth?next=/checkout?plan=<id>`.
- No hardcoded prices or checkout URLs in components — all read from `PLANS` + DB variant.

## 4. Server function updates

- `src/lib/billing.functions.ts`
  - Extend `createCheckoutSession` to reject `is_contact_sales` plans and to short-circuit with a friendly "Coming Soon" error when variant is missing/placeholder.
  - `listPublicPlans` already exists — extend select to include `success_fee_bps`, `starting_at_price_cents`, `is_contact_sales`.
- New `submitContactLead` server fn (public, Zod-validated, rate-limited by IP hash) → inserts into `contact_leads`.

## 5. Pricing page (`src/routes/pricing.tsx`)

Full rebuild, light-mode enterprise aesthetic:
- Hero + trust strip (No Credit Card · 14-Day Free Trial · Cancel Anytime · SOC2-ready · AI-Powered).
- 4-column plan grid with Growth featured (MOST POPULAR) and Enterprise (ENTERPRISE badge).
- CTA per plan wired through `resolveCta`.
- Success fee shown under price on every card.
- ROI calculator section (client component) — inputs: monthly failed payments, AOV, recovery rate; outputs: recovered revenue, platform fee, net revenue, ROI multiple. Live update.
- Full comparison table (responsive: table on md+, stacked accordion on mobile).
- FAQ (6 Qs from spec) using shadcn Accordion.
- Money-back / secure-checkout / trusted-by strip near CTAs.

## 6. Reusable components

- `src/components/pricing/plan-card.tsx`
- `src/components/pricing/pricing-grid.tsx`
- `src/components/pricing/comparison-table.tsx`
- `src/components/pricing/roi-calculator.tsx`
- `src/components/pricing/pricing-faq.tsx`
- `src/components/pricing/trust-strip.tsx`
- `src/components/pricing/cta-button.tsx` (single component that renders correct CTA based on `resolveCta`; handles "Coming Soon" disabled state and Enterprise → `/contact-sales`).

## 7. `/contact-sales` route

- New `src/routes/contact-sales.tsx` — enterprise lead form (company, name, email, role, seats, ARR range, use case, plan preselect from `?plan=enterprise`). Submits via `submitContactLead`. Success state with confirmation and calendar-link CTA (mailto for now).
- SEO head: title/description/canonical + JSON-LD `ContactPage`.

## 8. Site-wide CTA updates

Rewire every "Start Free Trial" / pricing CTA to import from `pricing.ts` + `resolveCta`:
- `src/routes/index.tsx` (homepage hero + pricing teaser)
- `src/routes/features.tsx`
- `src/routes/about.tsx`
- `src/routes/faq.tsx`
- `src/routes/docs.tsx`
- `src/components/marketing-chrome.tsx` (header + footer CTAs)
- `src/routes/_authenticated/upgrade.tsx` (rebuild against new plans + resolveCta with subscription awareness)
- `src/routes/_authenticated/checkout.tsx` (use `PLANS` display copy; block enterprise; show Coming Soon for Business until variant set)
- `src/routes/_authenticated/app.tsx` — Current Plan card (plan name, status, renewal, usage placeholder, Upgrade/Downgrade/Manage Billing buttons). Manage Billing is a stub button that toasts "Coming soon" if no LS customer portal URL yet.

## 9. Design constraints

- Light mode only. White / off-white surfaces (`bg-background`, `bg-card`), subtle borders (`border-border/60`), no glassmorphism, no neon, no gradients beyond one accent used sparingly. Existing tokens in `src/styles.css` reused; no new colors hardcoded.
- Typography and spacing match current marketing chrome (`MarketingHeader` / `MarketingFooter`).

## 10. Validation

- `bun run typecheck` clean.
- `bun run lint` clean.
- `bun run build` clean.
- Manual verification via preview screenshots (pricing page, /contact-sales, dashboard upgrade, homepage CTA).
- A11y: buttons have accessible labels, table has `<caption>`/`scope`, form inputs labelled, focus rings visible.
- SEO: unique `<title>`, meta description, canonical, JSON-LD `Product`/`Offer` on pricing.

## Technical notes

- `resolveCta` runs client-side; the auth state comes from `supabase.auth.getSession()` cached in a small `useSession` hook (already present pattern in codebase). Subscription state read from `workspaces` row via existing query. Loaders on public routes remain unauth.
- `submitContactLead` is a `createServerFn` **without** `requireSupabaseAuth` (public) — Zod validates, and we insert via server publishable client behind a narrow `TO anon` INSERT policy scoped to `contact_leads` only.
- Business plan gating: `PLANS.business.ctaState` is derived at build/render time from `plan.ls_variant_id` returned by `listPublicPlans`; if null/placeholder → `coming_soon`.
- No changes to webhooks, RLS on user/workspace tables, migrations for existing tables beyond additive columns.

## Out of scope (this turn)

- Actual metered billing of success fees (display only for now; column stored).
- Stripe customer portal integration (Manage Billing button stubbed).
- Multi-currency.
