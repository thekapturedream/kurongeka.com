# Kurongeka estate audit

_Everything found for kurongeka.com on 25 September 2026, and what should happen to it._

Sources searched: GitHub (all 39 repos in `thekapturedream`), Vercel (team Kapture, 45 projects), Wix (all sites in the account), Google Drive, Gmail, Notion. Not reachable from this session: NotebookLM, iCloud, Apple Notes and the local computer (no connector or device link was available).

## Web and code

| Asset | What it is | Recommendation |
|---|---|---|
| GitHub `thekapturedream/kurongeka.com` | **This repo.** New Astro + Wix Headless build on branch `claude/kind-gauss-m1rcch`. | Keep. The single source for kurongeka.com. |
| GitHub `thekapturedream/kurongeka` (private) | Old brand-audit portal (single 480 KB HTML file), patent log, Supabase schema. **Currently deployed to kurongeka.com.** | Archive after cut-over (not before: Vercel deploys from it). |
| GitHub `thekapturedream/kurongeka-os` (private) | Internal multi-site command centre (static JS). | Archive. Staff use the Wix Dashboard. |
| Vercel `kurongeka.com` | Serves kurongeka.com and www from the `kurongeka` repo. Domains verified. | Re-point to this repo at cut-over (Settings > Git), set Root and build to Astro defaults. |
| Vercel `kurongeka-os` | kurongeka-os.vercel.app. | Delete after archiving the repo. |
| Supabase `kurongeka.com` (via Vercel Marketplace) | Paused since May 2026. | Delete once confirmed empty. |

The other 36 repositories and 43 Vercel projects belong to other ventures and clients (Franjipanji, Kapture Aero, Air Zimbabwe, Borderless Love, Tura, and more). **They are not part of Kurongeka and should not be deleted.**

Nothing has been deleted or archived. That needs explicit approval, and archiving is recommended over deleting because it is reversible.

## Wix

| Site | State | Recommendation |
|---|---|---|
| `kurongeka.com` (c3203167-4ac8-469b-93a0-a3e8b63ca4ed) | Free plan, Studio editor, ZW locale, **now GBP**. **Now the Kurongeka backend.** | Keep. Buy a premium plan before taking payments. |
| `Kurongeka` (54e29d33-4f2e-4e8d-86d0-674455906bc6), 2024 | Free plan, empty store, ZA locale. | Retire (no data to migrate). |
| ~20 "Studio" template sites (Bright Smile Dental, Harvest Table Bistro, Village Care Medical, Summit Build Construction, CoreServe Business, Prism Media Agency and more) | Vertical demo sites created May 2026. Some contain real client contact details. | Use as the delivery starting point for each business model. Clean placeholder and client details before linking any as a public demo. |

Set up on the `kurongeka.com` Wix site today:

- Headless client **kurongeka.com web**, client ID `e7d4a9a8-c38f-459a-8960-e755c0c82b95`; redirect domains kurongeka.com and www.kurongeka.com.
- Wix Forms installed; form **Kurongeka Check** (`e7b244fb-0bc2-411c-98d1-4bd29e40a3c8`), which creates CRM contacts. Tested end to end, then the test lead was deleted.
- CMS collections: LaunchPackages, BusinessModels (9 seeded), Faqs (10 seeded), DirectoryListings (empty).
- Pricing Plans: Run Care £39, Run Grow £119, Run Partner £319 (monthly). Slugs are `run-care-1`, `run-grow-1` and `run-partner-1` because they replaced earlier USD versions; rename in the dashboard if you like.
- Site payment currency changed from USD to GBP. The one old Wix Stores product on this site ("Starlink V2") now shows its old number in pounds; review or delete it.

## Domains and email

| Item | State | Action |
|---|---|---|
| kurongeka.com | Registered at GoDaddy (renewing), DNS points to Vercel. | Keep. |
| kurongeka.app | Expired at Hostinger, June 2025. | Let it go. |
| Email on kurongeka.com | **No MX records.** info@kurongeka.com (listed in Wix) cannot receive mail. | Add Google Workspace or Zoho MX, then switch `CONTACT_EMAIL` to hello@kurongeka.com. The site uses hello@thekapture.com until then. |

## Social

| Channel | Evidence | Action |
|---|---|---|
| Instagram and Threads @kurongekadotcom | Instagram emails, 2024 | Linked in the footer and structured data. |
| Facebook Business "Kurongeka" | Business Manager email, April 2026 | Confirm the page URL, then add it to `src/config/site.ts`. |
| LinkedIn company page | LinkedIn email, May 2024 | Confirm the URL, then add it. |
| TikTok, YouTube, X | Not found | Reserve @kurongeka if available. |

One set of links lives in `src/config/site.ts` and feeds the footer and the Organization `sameAs` data.

## Security: act on these

1. **The live kurongeka.com publishes the client login pattern** (`{client}@thekapture.com / kap-{client}-2026`) and a demo password in its page source, and its "auth" runs in the browser. Anyone can work out client logins. Replace the live site (this build) and change any password that follows the pattern.
2. **The live site presents demo content as real.** Behind the publicly advertised demo login, it shows a fictional client founder ("Pearce Vusumuzi") and a press item attributing "Kapture wins Best Boutique Agency, Africa Brand Awards" to a real outlet (New Zimbabwe). Invented coverage credited to a real publication is a reputational and legal risk. It disappears at cut-over.
3. **A Supabase service-role key is stored in plain text** in the Google Drive file `Kurongeka.md` (for the kapture-logistics Supabase project). Rotate it in Supabase and remove it from the document.
4. **A classic GitHub token named "kurongeka.com"** with admin scopes (admin:org, admin:enterprise and more) was created in April 2026 and is expiring. Revoke it; use fine-grained tokens scoped to single repositories.
5. The Wix Studio premium plan on kurongeka.com lapsed in November 2025 after repeated card failures. Check the card on the Wix account before buying the new plan.
