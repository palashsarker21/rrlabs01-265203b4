# RRLabs Screenshot-Ready UI Polish

Given the surface area (~40 public routes, ~30 authenticated routes, admin, onboarding, settings) touching every screen at once is high-risk. This plan lands the polish in **safe, verifiable waves** built entirely on top of the existing design tokens in `src/styles.css` and the shadcn primitives already in `src/components/ui/`. Nothing is rebuilt; only spacing/typography/state polish is applied.

## Audit summary (current state)

Strengths already in place:
- Cohesive light-first token system in `src/styles.css` (semantic colors, radii, chart scale).
- shadcn/ui primitives used consistently; brand centralized in `src/lib/brand.ts`.
- Route architecture is clean (TanStack file-based, `_authenticated` gate).

Gaps to fix (recurring, cross-cutting):
1. **Typography scale drift** — headings jump between `text-2xl/3xl/4xl` inconsistently; no defined display/heading/eyebrow tokens.
2. **Card density inconsistency** — mix of `p-4`, `p-5`, `p-6`, `space-y-*` values across dashboard, analytics, integrations.
3. **KPI cards** — plain numbers, no eyebrow labels, no delta chips, no icon slot standard.
4. **Empty states** — many pages render bare "No data" strings; no illustrated/iconized empty component.
5. **Loading states** — mix of spinners and ad‑hoc skeletons; no shared `<PageSkeleton>` / `<TableSkeleton>` primitives.
6. **Status badges** — inconsistent colors between success/warning/destructive across integrations, billing, email delivery.
7. **Table polish** — header weight, row hover, zebra, sticky headers, empty rows, pagination alignment vary per page.
8. **Focus rings** — some custom buttons/links miss visible `:focus-visible` ring (WCAG 2.2 AA).
9. **Icon sizing** — Lucide icons appear as `h-4`, `h-5`, `size-4`, `size-5` mixed within same card.
10. **Hover/transition** — cards lack the subtle lift + border tint used by Linear/Vercel; buttons transition durations vary.
11. **Recovery workflow view** — currently a vertical list; not screenshot-worthy as described (needs a proper stepper diagram).
12. **Auth screens** — solid, but hero side lacks the split-panel product proof used by Clerk/Supabase.

## Waves

Each wave is independently shippable and reversible.

### Wave 1 — Foundations (design tokens + shared primitives)
- Extend `src/styles.css` with tokens (no rename, additive only): `--shadow-xs/sm/md/lg` tuned for white surfaces; `--tracking-tight`; refined `--muted-foreground` for AA on white; `.text-eyebrow` utility.
- Add typography utility layer: display/h1/h2/h3/eyebrow/kicker classes (via `@utility`).
- New shared components under `src/components/ui/`:
  - `page-header.tsx` — title, eyebrow, description, actions slot.
  - `stat-card.tsx` — icon, eyebrow, value, delta chip, footnote.
  - `empty-state.tsx` — icon, title, description, primary/secondary action.
  - `section-card.tsx` — Linear-style card with header row + optional toolbar.
  - `data-table-shell.tsx` — wraps existing tables with consistent header, toolbar, pagination alignment (opt-in, no forced migration).
  - `skeleton-block.tsx` variants (kpi, row, chart).
- Standardize `Badge` variants (`success`, `warning`, `info`, `neutral`) in existing `badge.tsx` (append, don't replace).

### Wave 2 — Dashboard + Analytics
- Apply `PageHeader` + `StatCard` to `_authenticated/dashboard.tsx`, `analytics.tsx`, `events.tsx`.
- Normalize chart container padding, add subtle grid, unify Recharts tooltip style via shared `chart-tooltip.tsx`.
- Consistent KPI row: 4-up on lg, 2-up on md, 1-up on sm; equal heights.
- Replace bare "No data" with `EmptyState`.

### Wave 3 — Recovery Engine workflow (screenshot centerpiece)
- New presentational component `recovery-workflow-diagram.tsx` — horizontal stepper on desktop, vertical on mobile:
  `Failed Payment → AI Analysis → Recovery Score → Email → WhatsApp → Retry Schedule → Recovered Revenue`.
- Icons per step, subtle animated pulse on active step, status pill, ETA under each.
- Uses realistic demo data from existing engine when available; no fake metrics.

### Wave 4 — Integrations grid
- Uniform integration card: logo (48px), name, one-line description, status badge, primary action.
- Consistent connection states: Not connected / Connecting / Connected / Needs attention / Verified.
- Card hover: `border-primary/40`, `shadow-sm` → `shadow-md`, 150ms.

### Wave 5 — Settings + Auth
- Settings: uniform tabbed shell, form spacing (`space-y-6`), helper text under inputs, inline validation icons.
- Auth (`auth.tsx`, `forgot-password`, `reset-password`, `verify-email`): add optional right-side product proof panel behind an env-safe flag; left panel unchanged in functionality. Improve field spacing, focus rings, and password strength card padding only.

### Wave 6 — Tables + Badges + Icons sweep
- Apply `data-table-shell` to admin/email/billing/team tables.
- Icon size lint: standardize to `size-4` (inline text) and `size-5` (buttons/cards) per component with a codemod-style search-replace, verified per file.
- Focus-visible audit for interactive elements missing rings.

### Wave 7 — Marketing (landing, pricing, features, about, contact, security, docs)
- Section rhythm: `py-20 sm:py-24 lg:py-28` standard; container `max-w-6xl` for content, `max-w-7xl` for grids.
- Hero typography scale: display 56/64/72 responsive; body `text-lg text-muted-foreground`.
- FAQ: unify Accordion styling, add hover, better spacing.
- Footer alignment fixes; consistent column gap.

## Guardrails

- No route removed. No prop signatures changed on shared components — new components are additive; existing routes migrate opt-in wave by wave.
- Zero business-logic touches: server functions, migrations, RLS, integrations left alone.
- Type strictness maintained; `tsgo` clean per wave.
- A11y: every new component ships with `aria-*`, visible focus ring, and `size` variants that clear 44×44 tap targets on mobile.
- Bundle: no new heavy deps. Reuse `lucide-react`, `recharts`, `class-variance-authority` already installed.
- Perf: purely presentational changes; no new client fetches. Animations use `transition-{colors,shadow,transform}` under 200ms — no layout-shift.

## Technical notes

- New utilities go into `src/styles.css` via `@utility` (Tailwind v4 correct form).
- Shared components go under `src/components/ui/` and are re-exported from an `index.ts` for ergonomics.
- Migrations per route are done as small search-replace edits, verified by `bun run build` after each wave.
- Existing tests remain green; new snapshot tests only if a component is highly visual (e.g. `stat-card`).

## Deliverables per wave

1. List of files touched.
2. Screenshot-ready pages produced.
3. A11y notes (contrast, focus, motion).
4. Build + typecheck pass.

## Suggested execution order

Wave 1 → 2 → 3 → 4 → 5 → 6 → 7. Each wave = one commit-sized change.
Please approve to start with **Wave 1 (Foundations)**, or tell me which wave to prioritize (e.g. jump straight to Wave 3 for the workflow hero shot).
