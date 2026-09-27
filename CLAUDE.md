# kurongeka.com

Kurongeka ("to be properly arranged", Shona) is a productised launch-and-run service for small businesses, run from the **United Kingdom** by Kapture. It serves UK businesses and diaspora-owned businesses in Southern Africa: fixed-price website/brand/payments launches, then monthly Run plans. Strategy: `docs/strategy.md`. Estate audit and clean-up list: `docs/estate.md`.

## Rules

- **All prices are in GBP (£).** Launch packages, Run plans, copy, structured data and examples. Never show USD. The currency constant is `CURRENCY` in `src/lib/domain/format.ts`; format with `formatPrice()`. The Wix site currency is GBP. Prices are approved as they are in Wix.
- **The business is UK-based.** UK phone and WhatsApp (+44 7352 144677), GB default country, England and Wales law, UK GDPR and the ICO. Southern Africa is a market, not the base.
- **Wix is the back office; the apps are custom.** Wix does admin, CRM (contacts, forms), CMS, members and community. Every customer-facing feature is custom code in this repo talking to Wix through `src/lib/wix/`. Do not send visitors to Wix-designed pages.
- **Wix is the only backend.** No other database (no Supabase, Postgres, KV, Blob or browser storage as a record) and no other auth (no passwords, sessions or user tables of our own). Accounts are Wix Members; records are Wix CMS, Forms, Contacts and Pricing Plans. The `kurongeka-web` Vercel project has no environment variables and needs none.
- Prices, packages, business models and FAQs live in Wix, not in code. Change them in the Wix Dashboard.
- No invented proof: no testimonials, stats, awards, client logos or "most popular" claims unless real and approved.
- **Type:** Wix Madefor Display Bold (700) for headlines, figures and emphasis; Wix Madefor Text Regular (400) for body copy, buttons, navigation and labels. Only these two cuts are declared (`src/lib/fonts.ts`: Latin preloaded, Latin Extended on demand); never use another weight or `medium`/`semibold`, and do not import Fontsource CSS (its subset files lack `unicode-range`).
- **Findability first.** The home page opens on "What does your business need?" with search and one tile per solution. New offers become a Solution in Wix, not a new homepage section.
- Yellow (#FFCC00) only on ink surfaces. Sentence case. No emoji.
- Kapture Web Build Standard applies (user-level instructions).

## Architecture

- **Frontend:** Astro 7, TypeScript (strictest), SSR on Vercel (`@astrojs/vercel`, functions in `lhr1`, 30 s max). Static pages opt in with `export const prerender = true`. CMS pages set CDN caching via `cachePage()` (`src/lib/http.ts`) so Wix edits appear within minutes. Personal and form pages use `noStore()`.
- **Backend:** Wix site **kurongeka.com**, metaSiteId `c3203167-4ac8-469b-93a0-a3e8b63ca4ed`. Self-managed headless (do not run `npm create @wix/new`; it provisions a new site). Its Wix-designed frontend (kapturestudio.wixstudio.com/kurongeka) stays published only because Wix hosts the password-reset page and logout there; it is `noindex`. Wix SEO redirects from its sections to `/w/*` on our site (`src/pages/w/[...path].ts`) are saved but Wix only runs them once the site has a premium plan with a connected domain.
- **Headless client:** "kurongeka.com web", client ID `e7d4a9a8-c38f-459a-8960-e755c0c82b95` (not a secret). Login URL, redirect domains and redirect URIs (`/account/callback`, `/account/password-updated`, localhost 4321/4322) are set on it. No admin API keys in this project.
- **Layers:** `src/lib/domain/` (pure logic, zod schemas) → `src/lib/wix/` (maps Wix data) → `src/lib/services/` (caching, `{ ok, data }` results, rate limits) → pages. Forms are server-rendered POSTs handled in the page (progressive enhancement); Astro's origin check blocks cross-site POSTs.
- **Accounts:** custom log in, sign-up, email code, reset and log out on Wix Members (`src/lib/auth/`). Wix returns a session token; the server exchanges it for member tokens (PKCE, server-side hop, browser fallback via `/account/callback`) and keeps them in the HTTP-only `kg_session` cookie. `memberSession().persist()` saves renewed tokens and ends dead sessions.
- **Client portal:** `/account` reads the member's own items from CMS `Projects` (read SITE_MEMBER_AUTHOR, insert SITE_MEMBER, update/remove ADMIN) and their Pricing Plans orders. `/account/brief` creates a project and sends a "Launch brief" enquiry so staff are notified.
- **Leads:** `/check` → `POST /api/check` → Wix form "Kurongeka Check" (`e7b244fb-…`). Everything else (free calls, questions, website fixes, directory applications, launch briefs) → Wix form "Kurongeka enquiry" (`12c98587-2471-4c55-b003-1ffb0ec99ae5`), labelled by `topic`. Each submission uses a fresh visitor identity so different people are not merged.
- **Solutions and search:** `/solutions` and `/solutions/[slug]` render the Wix `Solutions` collection (price from the referenced cheapest `LaunchPackages` item, or the cheapest Run plan when `offer` is `run`). Search logic is pure and shared by server and browser (`src/lib/domain/search.ts`, unit tested); the index is built from solutions, business models, tools and key pages (`src/lib/domain/search-index.ts`, `src/lib/services/search.ts`). `/find?q=` renders results without JavaScript (noindex); `src/components/finder/Finder.astro` + `src/scripts/finder.ts` add instant suggestions.
- **Free tools** (`/tools`): website check (`src/lib/services/website-check.ts`: SSRF-safe fetch, public hosts only, re-checked redirects, size and time limits; analysis in `src/lib/domain/website-check.ts`), name and domain check (public RDAP: Nominet, Verisign, PIR), brand colours (WCAG maths in `src/lib/domain/colour.ts`, runs in the browser), email signature (browser only).

## Wix data (Dashboard is the control centre)

| Content | Where staff manage it |
|---|---|
| Solutions (title, summary, intro, what's included, search keywords, icon, `offer` launch/run, `fromPackage` reference, related tool) | CMS > Solutions. Drives the home tiles, `/solutions` pages and search |
| Launch packages (title, `priceGbp`, delivery days, inclusions) | CMS > LaunchPackages |
| Business models | CMS > BusinessModels (`recommendedPackage` references LaunchPackages) |
| FAQs (`topic`: general, pricing, launch, run, payments) | CMS > Faqs |
| Directory (shown only when `isPublished` and `consentConfirmed`) | CMS > DirectoryListings; applications arrive as "Directory listing" enquiries |
| Client projects (status: brief_received, in_progress, review, live, on_hold; next step, update, preview/live/files links, target date, deposit) | CMS > Client projects. Clients create them via the launch brief; staff edit them |
| Run plans (monthly, GBP) | Pricing Plans |
| Leads and requests | Forms & Submissions > Kurongeka Check / Kurongeka enquiry, and Contacts |
| Client accounts | Members (Contacts & Members) |

## Commands

```bash
npm run dev        # astro dev (Astro 7 backgrounds it; `npx astro dev stop` to stop)
npm run check      # astro check (types)
npm test           # vitest unit tests (tests/unit)
npm run test:e2e   # playwright (tests/e2e), desktop + mobile; never writes to Wix
npm run build      # production build (.vercel/output)
npm run verify     # check + test + build
```

## Environment

Optional overrides only; defaults in `astro.config.mjs`: `WIX_CLIENT_ID`, `WIX_CHECK_FORM_ID`, `WIX_ENQUIRY_FORM_ID`, `WHATSAPP_NUMBER`, `CONTACT_EMAIL`. Contact email is hello@thekapture.com until kurongeka.com has MX records.

## Deployment

- Vercel team Kapture (`team_ALuRt7rxrmv2cVKG1K66Mc96`), project **kurongeka-web** (`prj_sDb4GmV5N3F8Krlo4yhURKtLyPQt`), linked to this repo, region `lhr1`. Production went live on 25 September 2026.
- `www.kurongeka.com` and `kurongeka.com` are attached to the live kurongeka-web deployment as **aliases** (the apex alias redirects to www). The domain records still belong to the old project **kurongeka.com** (`prj_yZb86tfJj8liceEjcijPjka78ZZz`), which is **paused** (it served the old portal with browser-side logins and holds the Supabase connection). Until the domains are moved in the Vercel dashboard, re-assign both aliases after each production deploy.
- Deploy: `create_deployment` (target production) for the commit, check it, then `assign_alias` www.kurongeka.com to it, and kurongeka.com to it with `redirect: www.kurongeka.com`. Roll back by aliasing to the previous deployment.
- `kurongeka-os` (`prj_QIhOcuzW6rIk4xLacyxAg60CJtg7`), the old command centre with its own logins, is **paused**. Staff use the Wix Dashboard. Do not unpause either old project.
- Only publish when asked (publish, deploy, release, go live).

## Known constraints

- Wix site is on the free plan: no online payments or Wix-hosted checkout until a premium plan is bought.
- Wix Forms spam filtering drops some submissions (for example `@example.com` emails); test with realistic data and delete test leads, members and contacts afterwards.
- Wix files each form submission under an existing contact matched by email, then by phone. Use a different phone number for every test lead, or test leads merge into one contact.
- Signing up with an email that is already a Wix contact (for example after the Kurongeka Check) makes Wix send a 6-digit code; `/account/verify` takes it. New emails sign in straight away.
- Wix Bookings cannot confirm bookings made by visitors, so "Book a free call" is a request that staff confirm.
- Directory is empty until the first consented listing; the page is `noindex` while empty.
