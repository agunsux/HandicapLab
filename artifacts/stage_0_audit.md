# STAGE 0 AUDIT

**A. Monetization status**
OFF. No real payment gateways (Stripe/Xendit) are active in the application flow. 

**B. Payment status**
MOCK. The `/pricing` page redirects to `/signup`, and the `/checkout` directory only contains a `/mock-success` route that simulates a Stripe webhook locally using `evt_` strings and a `fetch` call to the webhook endpoint.

**C. Settled signal counts**
0 (or minimal). Direct database query script failed with an authentication error, but `FINAL_PRODUCTION_STATUS.md` confirms 65 Paper Trades exist and all are in `PENDING` state. There are no settled signals yet.

**D. Current production pipeline status**
INCONSISTENT / FAILED. While `FINAL_PRODUCTION_STATUS.md` optimistically claims "READY: YES", the `PRODUCTION_PIPELINE_STATUS.md` indicates the pipeline is blocked by check constraints (`matches_competition_type_check`) and missing columns in `predictions` and `paper_trades`. 

**E. Real vs mock data findings**
MOCK DATA DETECTED. `FINAL_PRODUCTION_STATUS.md` lists the latest fetched match as "Everton vs Arsenal in Ligue 1" on `2026-07-04`. This is impossible in reality and confirms synthetic/mock data is sitting in production tables.

**F. Existing authentication/entitlement status**
Basic server-side gating exists. `determineUserAccess(userId)` is used in pages to yield `isPremium` and `dailyLimit`.

**G. Current frontend → backend data flow**
Server Components directly query the Supabase database. For example, `src/app/page.tsx` directly queries `supabase.from('predictions').select('*, fixtures(*)')...`.

**H. Current navigation architecture**
Fragmented. There is marketing navigation (`NavigationChrome.tsx` -> `Header.tsx` & `Footer.tsx`) and application navigation (`Sidebar.tsx`).

**I. Current homepage architecture**
Follows a rough outline: Compact Hero ("The Math Behind the Match") -> Today's Value Bets (Preview Table) -> How It Works (3 Steps) -> What We Are Not.

**J. Current sidebar architecture**
A collapsible React component (`Sidebar.tsx`) using `lucide-react` icons. State (pinned vs unpinned) is persisted to `localStorage`. Width is 224px (w-56) expanded and 64px (w-16) collapsed.

**K. Current freemium architecture**
Server-side data truncation. In `page.tsx`, if the user is not premium, sensitive fields (`edge`, `ev`, `fairOdds`, `marketOdds`, `modelProb`) are replaced with `undefined` and `selection` is set to `HIDDEN`. Then, the array is sliced: `mappedOpportunities = mappedOpportunities.slice(0, dailyLimit)`. This means free users don't see the locked rows at all—they just disappear.

**L. Risks**
1. **Mock Data Bleed:** The homepage will render "Everton vs Arsenal in Ligue 1" if connected to the current database, severely damaging product credibility.
2. **Freemium UX:** Since non-premium users have their arrays sliced, they won't see the blurred/locked state of the remaining signals, breaking the intended freemium upsell experience.
3. **Pipeline Instability:** The schema mismatch might prevent real data from flowing in.

---

SAFE TO PROCEED TO STAGE A:
YES

PIPELINE RISK:
HIGH

MONETIZATION STATUS:
OFF

MOCK DATA DETECTED:
YES
