# kurongeka.com

Kurongeka ("to be properly arranged", Shona) is a productised launch-and-run service for small businesses in Southern Africa, the UK and the diaspora, by Kapture. It sells fixed-price website/brand/payments launches, then monthly care. Strategy: `docs/strategy.md`. Estate audit and clean-up list: `docs/estate.md`.

## Rules

- **All prices are in GBP (£).** Launch packages, Run plans, copy, structured data and examples. Never show USD. The currency constant is `CURRENCY` in `src/lib/domain/format.ts`; format with `formatPrice()`. The Wix site currency is GBP.
- Prices, packages, business models and FAQs live in Wix, not in code. Change them in the Wix Dashboard.
- No invented proof: no testimonials, stats, awards, client logos or "most popular" claims unless real and approved.
- Yellow (#FFCC00) only on ink surfaces. Sentence case. No emoji.
- Kapture Web Build Standard applies (user-level instructions).

## Architecture

- **Frontend:** Astro 7, TypeScript (strictest), SSR on Vercel (`@astrojs/vercel`). Static pages opt in with `export const prerender = true`. CMS pages set CDN caching via `cachePage()` (`src/lib/http.ts`, s-maxage 300) so Wix edits appear within minutes without a deploy.
- **Backend:** Wix site **kurongeka.com**, metaSiteId `c3203167-4ac8-469b-93a0-a3e8b63ca4ed`. Self-managed headless (the Wix-managed/Astro CLI flows would provision a new site; do not run `npm create @wix/new`). The 2024 site "Kurongeka" (54e29d33…) is not used.
- **Auth:** visitor OAuth only (`OAuthStrategy`). Headless client "kurongeka.com web", client ID `e7d4a9a8-c38f-459a-8960-e755c0c82b95` (not a secret). No admin API keys in this project.
- **Wix layer:** `src/lib/wix/` (client, cms, plans, forms, media) maps raw Wix data to domain types in `src/lib/domain/types.ts`. Pages call `src/lib/services/` (cached, returns `{ ok, data }` so pages render error states).
- **Leads:** `/check` (progressive-enhancement form, `src/scripts/check-flow.ts`) → `POST /api/check` → validation and scoring in `src/lib/domain/check.ts` → Wix Forms form "Kurongeka Check" (`e7b244fb-0bc2-411c-98d1-4bd29e40a3c8`), which creates a CRM contact. Each lead uses a fresh visitor identity so separate people are not merged. Result page: `/check/result` (scores in the URL, never personal data).

## Wix data (Dashboard is the control centre)

| Content | Where staff manage it |
|---|---|
| Launch packages (title, `priceGbp`, delivery days, inclusions) | CMS > LaunchPackages |
| Business models | CMS > BusinessModels (`recommendedPackage` references LaunchPackages) |
| FAQs (`topic`: general, pricing, launch, run, payments) | CMS > Faqs |
| Directory (shown only when `isPublished` and `consentConfirmed`) | CMS > DirectoryListings |
| Run plans (monthly, GBP) | Pricing Plans |
| Leads | Forms & Submissions > Kurongeka Check, and Contacts |

## Commands

```bash
npm run dev        # astro dev (Astro 7 backgrounds it; `npx astro dev stop` to stop)
npm run check      # astro check (types)
npm test           # vitest unit tests (tests/unit)
npm run test:e2e   # playwright (tests/e2e); mocks /api/check, reads live Wix content
npm run build      # production build (.vercel/output)
npm run verify     # check + test + build
```

## Environment

Optional overrides only; defaults in `astro.config.mjs`: `WIX_CLIENT_ID`, `WIX_CHECK_FORM_ID`, `WHATSAPP_NUMBER`, `CONTACT_EMAIL`. Contact email is hello@thekapture.com until kurongeka.com has MX records.

## Deployment

Vercel project `kurongeka.com` (team Kapture) owns kurongeka.com and www (apex redirects to www). It still deploys the old `kurongeka` repo; production cut-over (re-point Git to this repo) needs explicit approval. Never publish to production without it.

## Known constraints

- Wix site is on the free plan: no payments until a premium plan is bought.
- Wix Forms spam filtering drops some submissions (for example `@example.com` emails); test with realistic data and delete test leads afterwards.
- Directory is empty until the first consented listing; the page is `noindex` while empty.
