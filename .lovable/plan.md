# Production Readiness Audit & Completion

This is a large multi-phase job. To keep it safe and reviewable, I will execute it in ordered phases, auditing first, then fixing. No redesign, no removal of working features, no placeholders.

## Phase A — Audit (read-only)
Sweep the codebase and produce a written baseline in `.lovable/production-audit.md`:
1. Brand token scan: grep for `Revenue Recovery`, `Recovery Labs`, `Revenue Labs`, `RevenueRecovery`, `RRLABS`, stray casings, and any hard-coded company names outside `src/lib/brand.ts`.
2. Asset scan: enumerate `src/assets/brand/*.asset.json`, `public/manifest.webmanifest`, favicons, OG/Twitter images, `browserconfig.xml`, mstile, apple-touch-icon. Confirm every referenced URL resolves.
3. Head-meta scan: every route file's `head()` — title, description, canonical, og:*, twitter:*, JSON-LD. Flag defaults ("Lovable App", "Lovable Generated Project"), missing per-route metadata, root-level `og:image` leakage.
4. Legal/company content scan: About, Contact, Privacy, Terms, Refund, Cookies, Security, FAQ, Status, Docs, Blog. Confirm no lorem ipsum, no TODO, no dummy addresses.
5. Header/footer: confirm `MarketingHeader`/`MarketingFooter` render brand tokens from `src/lib/brand.ts` only.
6. PWA: manifest fields, maskable icons, theme_color/background_color, shortcuts, offline page (only if already present — per no-redesign rule).
7. SEO plumbing: `robots.txt`, `sitemap.xml`, JSON-LD types on Home/Pricing/About/Contact/FAQ/Blog/Post, breadcrumbs, `<h1>` uniqueness, image alt coverage.
8. Cleanup targets: dead code, duplicate implementations, orphan routes, broken internal links.
9. Build health: typecheck, lint, `bun run build` (production).

Deliverable: `.lovable/production-audit.md` with PASS/WARN/FAIL per category, file:line evidence.

## Phase B — Brand standardization
Fixes derived from Phase A #1, #5:
- Any string not sourced from `src/lib/brand.ts` gets rewritten to use `BRAND.name` ("RRLabs") or `BRAND.company` ("Revenue Recovery Labs").
- Update page titles, emails, PWA manifest name/short_name, error/loading/offline copy, invoice/receipt strings, admin console labels.
- Single source of truth remains `src/lib/brand.ts`; no new brand constants.

## Phase C — Assets & PWA
- Verify each `*.asset.json` resolves; regenerate missing icon sizes only if a reference exists but the asset is broken.
- Fix manifest.webmanifest fields (name, short_name, theme_color, background_color, icons array with `purpose: "any maskable"`, start_url, scope, display).
- Ensure `<link rel="apple-touch-icon">`, favicon links, and `theme-color` meta are set in `__root.tsx`.
- Keep existing service-worker posture; do NOT add a new SW unless one already exists (rule from PWA skill).

## Phase D — SEO / AEO / GEO / LLMO / AIO / SXO
- Per-route `head()` in every public route: unique title (<60 chars), description (<160), canonical (leaf-only), og:title/description/type/url, twitter:card.
- Add JSON-LD: Organization + WebSite at root; SoftwareApplication on `/`; Product/Offer on `/pricing`; FAQPage on `/faq`; Article + BreadcrumbList on blog posts; ContactPage on `/contact`; AboutPage on `/about`.
- `robots.txt`: `Allow: /`, sitemap directive.
- `sitemap.xml` server route: enumerate every public route + published blog slugs from `content/blog/*.md`.
- Breadcrumbs on nested pages, semantic `<h1>` per page, image alt audit.
- AEO: ensure FAQ/Docs pages have question-first H2s and direct-answer paragraphs (only where content already exists — no fabrication).
- GEO/LLMO: entity consistency (RRLabs, Revenue Recovery Labs, product taxonomy), stable internal linking. No new marketing pages.

## Phase E — Legal & company content
Where existing pages have thin/placeholder copy, extend to enterprise-grade content: Privacy, Terms, Refund, Cookies, Security, DPA, Subprocessors, Acceptable Use, Accessibility Statement, Responsible Disclosure, Data Retention. Cross-link between them. Contact info sourced from `src/lib/brand.ts` `CONTACT`.

New files only if missing: `/dpa`, `/subprocessors`, `/acceptable-use`, `/accessibility`, `/responsible-disclosure`, `/data-retention`. Otherwise edit in place.

## Phase F — Cleanup
- Remove lorem ipsum, TODO markers, dummy data (search for `TODO`, `FIXME`, `lorem`, `placeholder`).
- Remove dead exports / duplicate helpers surfaced in Phase A.
- Do NOT remove working functionality.

## Phase G — Final validation
- `tsgo` typecheck
- `bun run lint`
- `bun run build`
- Playwright smoke: `/`, `/pricing`, `/blog`, `/faq`, `/contact`, `/auth`, `/app` (screenshots + console errors)
- Verify `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` respond 200 with correct content-type.

## Phase H — Final report
Write `.lovable/production-audit-final.md` with PASS/WARN/FAIL matrix for all 24 categories in the request, list of files changed, and confirmation that no placeholders/TODOs/duplicates remain.

## Approval model
Given the scope, I'll pause for approval after **Phase A (audit)** so we can review scope and priorities before making changes. After approval I'll run B→H sequentially, reporting a short delta after each.

## Non-goals (explicit)
- No visual redesign.
- No new architecture, no framework swap.
- No removal of working features (integration center, admin, billing, blog, etc.).
- No new SaaS pricing/plan changes.
- No new external dependencies unless required to fix a broken asset.
