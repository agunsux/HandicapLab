# HandicapLab v3 — Design System Specification

> **Positioning:** HandicapLab is a football market intelligence platform — a "Bloomberg Terminal for football markets." This spec codifies the **Quiet Intelligence** design language: a very dark, near-black green canvas with muted, Pantone-inspired pastel accents used *semantically* (never decoratively). The goal is institutional trust, data density, and calm authority — not tipster hype.

This document is the single source of truth for the v3 redesign. It covers all 20 deliverables: UX Audit, Information Architecture, User Flow, Navigation, Design System Spec, Color Tokens, Typography Tokens, Component Library, Landing Page, Dashboard, Pricing Page, Blog Architecture, i18n Strategy, SEO Strategy, PPP Pricing, Money-Back Guarantee UX, Free Trial UX, Accessibility, Performance, and Implementation Roadmap.

---

## 1. UX Audit (Current State → Target)

| Area | Current State | v3 Target |
|------|---------------|-----------|
| Visual density | Sparse, generic SaaS | Dense, Bloomberg-style command center |
| Color | Emerald-on-black (hype) | Deep Forest + muted pastel accents (semantic) |
| Typography | Space Grotesk (playful) | Inter (institutional) + tabular figures |
| Data presentation | Cards with vague metrics | Tabular figures, CLV/EV/Brier-first |
| Trust signals | Minimal | Calibration curves, CLV, audit trail |
| Positioning | "Predictions" | "Market intelligence / edge engineering" |
| i18n | English only | 6 locales with English fallback |
| Pricing | Static | PPP-adjusted, monthly/yearly toggle |

**Key UX principle:** Every number on screen must answer "what should I do with this?" — stake size (Kelly), timing (BET NOW / WAIT / NO BET), and confidence (Quant Score) — never just "here's a prediction."

---

## 2. Information Architecture (IA)

```
/                          → Landing (marketing)
/pricing                   → Plans + PPP + guarantee
/blog                      → SEO content hub
/blog/[slug]               → Articles with structured data
/dashboard                 → Bloomberg-style command center (app)
/markets                   → Market scanner
/models                    → Model transparency & calibration
/performance               → Track record, CLV, Brier
/resources                 → Docs, methodology, trust center
/account                   → Billing, tier, watchlist
```

**Route groups:** `(marketing)` for public pages, `(app)` for authenticated terminal. The root `/` is served by `src/app/page.tsx` (the new landing page); the legacy `(marketing)/page.tsx` was removed to eliminate the route conflict.

---

## 3. User Flow

1. **Discover** → Landing page (hero → social proof → how it works → transparency → pricing).
2. **Evaluate** → Pricing page with PPP-adjusted price + 14-day free trial CTA.
3. **Activate** → Sign up (no credit card) → free tier unlocks 3 picks/day.
4. **Operate** → Dashboard command center: Today's Opportunities → EV-ranked feed → Kelly stake → bet slip.
5. **Verify** → Performance page: CLV, calibration curve, Brier score, audit trail.
6. **Upgrade** → Paywall gate → Pro/Quant tier → full feed + API.

---

## 4. Navigation

Primary nav (Header): **Dashboard · Today's Opportunities · Markets · Models · Performance · Pricing · Blog · Resources** + **Sign In** + **Start Free Trial**.

- Active route highlighted via `usePathname()`.
- Mobile: hamburger → slide-down menu.
- Language selector: EN / 中文 / हिन्दी / ES / FR / ID.
- Footer: Product / Resources / Company columns + trust strip ("30-Day Money-Back Guarantee", "14-Day Free Trial · No Credit Card Required") + responsible gambling disclaimer.

---

## 5. Design System Spec

### 5.1 Design Principles
1. **Quiet Intelligence** — calm, dark, institutional. No neon, no hype.
2. **Data over decoration** — every accent color carries meaning.
3. **Tabular clarity** — numbers align, figures are monospaced.
4. **Trust by default** — CLV, calibration, and audit are first-class citizens.
5. **Accessible** — WCAG AA contrast, focus-visible, reduced-motion.

### 5.2 Spacing Scale (4px base)
`0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`

### 5.3 Radius
- `sm: 0.375rem` (inputs, badges)
- `md: 0.5rem` (buttons, small cards)
- `lg: 0.75rem` (cards, panels) ← **default**
- `xl: 1rem` (hero, modals)

### 5.4 Elevation (shadows)
- `elevation-1`: `0 1px 2px rgba(0,0,0,0.3)`
- `elevation-2`: `0 4px 12px rgba(0,0,0,0.35)`
- `elevation-3`: `0 8px 24px rgba(0,0,0,0.4)`
- Inset highlight: `0 1px 0 rgba(255,255,255,0.03) inset`

---

## 6. Color Tokens

Defined in `src/app/globals.css` as CSS custom properties + Tailwind `@theme`.

### 6.1 Surfaces (Deep Forest / Charcoal Green)
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#0E1410` | Page background (near-black green) |
| `--surface` | `#141C16` | Cards, panels |
| `--surface-raised` | `#1A241C` | Hover, elevated cards |
| `--border` | `#24301F` | Hairlines, dividers |
| `--border-strong` | `#33402C` | Focused borders |

### 6.2 Text
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#E8EDE4` | Headings, primary text |
| `--text-secondary` | `#A9B5A3` | Body text |
| `--text-muted` | `#8A9B87` | Labels, hints |
| `--text-faint` | `#5C6B59` | Disabled, meta |

### 6.3 Semantic Accents (Pantone-inspired pastels — used ONLY for meaning)
| Token | Hex | Semantic meaning |
|-------|-----|------------------|
| `--accent-sage` | `#A3BE8C` | Positive / edge / value (EV, CLV, ROI) |
| `--accent-terracotta` | `#D08A6B` | Negative / risk / caution |
| `--accent-purple` | `#A99BC9` | Model / intelligence / research |
| `--accent-gold` | `#D7B26D` | Neutral emphasis / highlights / stars |

**Rule:** Sage = positive signal, Terracotta = negative/risk, Purple = model/quant, Gold = neutral emphasis. Never use color decoratively.

---

## 7. Typography Tokens

- **Font family:** `Inter` (UI + body), `ui-monospace`/`SFMono` (tabular figures, data).
- **Weights:** 400 (body), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold).
- **Type scale:** `text-xs` (10–12px labels), `text-sm` (14px body), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px), `text-3xl` (30px), `text-4xl` (36px), `text-5xl` (48px hero).
- **Tabular figures:** `.tabular-nums` utility for all numeric data (EV, odds, CLV, scores) so digits align vertically.
- **Letter-spacing:** `tracking-tight` for headings, `tracking-wider`/`tracking-[0.18em]` for uppercase labels.

---

## 8. Component Library

Built on shadcn/ui primitives, restyled with the Quiet Intelligence tokens.

| Component | File | Notes |
|-----------|------|-------|
| Button | `src/components/ui/button.tsx` | Variants: primary (sage), secondary, ghost, outline |
| Card | `src/components/ui/card.tsx` | Surface + border + elevation-1 |
| Badge | `src/components/ui/badge.tsx` | Semantic tones |
| Table | `src/components/ui/table.tsx` | Sticky headers, dense rows |
| Header | `src/components/layout/Header.tsx` | Nav + language selector + CTAs |
| Footer | `src/components/layout/Footer.tsx` | Trust strip + disclaimer |
| DashboardOverview | `src/components/dashboard/DashboardOverview.tsx` | Bloomberg command-center ribbon |
| OpportunitiesTable | `src/components/opportunities/OpportunitiesTable.tsx` | EV-first feed |
| StructuredData | `src/components/StructuredData.tsx` | JSON-LD (Organization, Breadcrumb, FAQ, Article) |
| PricingCards | `src/app/pricing/PricingCards.tsx` | Monthly/yearly + PPP |

---

## 9. Landing Page (`src/app/page.tsx`)

Sections in order:
1. **Hero** — "Football market intelligence, engineered for edge." + Start Free 14-Day Trial / View Live Predictions.
2. **Social Proof** — ROI 4.2%, 12.5k picks, 68% CLV, 0.21 Brier.
3. **Live Preview** — OpportunitiesTable (real component).
4. **How It Works** — 3 steps (Model → Edge → Stake).
5. **Why HandicapLab** — 3 cards (Calibration, CLV, Explainability).
6. **Model Transparency** — sample statistical breakdown panel.
7. **Performance Metrics** — 4 cards (CLV, Brier, ROI, Kelly).
8. **Scientific Validation** — methodology + audit.
9. **Testimonials** — 3 quotes.
10. **Pricing** — Free + Pro preview.
11. **Money-Back Guarantee** — 30-day.
12. **FAQ** — `<details>` accordions.
13. **Final CTA** — Start Free Trial.

Includes `StructuredData` Organization JSON-LD.

---

## 10. Dashboard (`src/app/(app)/dashboard/page.tsx` + `DashboardOverview`)

- **Command Center ribbon** (`DashboardOverview`): Today's Opportunities, Highest EV, Confidence, Expected ROI, CLV, Historical Accuracy, Model Agreement, Recent Performance — all tabular figures, semantic tones.
- **Best Bet hero card** — #1 quant value pick with fair odds, best odds, quarter-Kelly stake.
- **Portfolio & risk meter** — picks count, expected ROI, bankroll exposure, risk level.
- **Daily intelligence loop** — yesterday ROI → today's opportunities → bankroll → next kickoffs.
- **Yesterday settlement audit** — immutable snapshot table (accuracy, ROI, CLV, Brier).
- **Today's predictions feed** — EV-descending, filters (league/market/watchlist), expandable explainability drawer (driver tags, cohort validation, multi-bookmaker matrix).
- **Bet slip** — portfolio correlation & risk audit, Kelly-weighted stake, lock & execute.
- **Paywall gate** — free tier shows 3 picks, upgrade CTA.

---

## 11. Pricing Page (`src/app/pricing/page.tsx` + `PricingCards.tsx`)

- **4 plans:** Free, Starter ($9/mo), Pro ($29/mo), Quant ($99/mo).
- **Billing toggle:** Monthly / Yearly (20% discount).
- **PPP pricing:** auto-adjusts by country via `x-vercel-ip-country` header (`src/lib/pricing/ppp.ts`). Factors: ID 0.4, IN 0.35, CN 0.55, etc. Ineligible countries (US/EU) get full price.
- **Guarantee section:** 30-day money-back.
- **FAQ** with `StructuredData` FAQPage JSON-LD.

---

## 12. Blog Architecture (`src/app/blog/`)

- **Index** (`page.tsx`): 12 categories, featured post + grid, BreadcrumbList JSON-LD.
- **Article** (`what-is-closing-line-value/page.tsx`): canonical URL, OpenGraph article type, Article + Breadcrumb + FAQ JSON-LD, key-takeaways box, next-article link.
- **SEO:** `robots.ts`, `sitemap.ts`, metadataBase, title template, OpenGraph, Twitter cards, canonical.

---

## 13. i18n Strategy (`src/lib/i18n/index.ts`)

- **Locales:** `en` (default), `zh`, `hi`, `es`, `fr`, `id`.
- **Mechanism:** message catalog with English fallback; `t(key)` helper; `getDir`/`getHtmlLang` for RTL/LTR and `lang` attribute.
- **Scope:** nav, hero, trust, pricing labels. Content-heavy pages (blog) remain English-first with progressive translation.

---

## 14. SEO Strategy

- **Structured data:** Organization (landing), BreadcrumbList (blog/pricing), FAQPage (pricing/blog), Article (posts), SportsEvent (future).
- **Metadata:** `metadataBase`, title template, description, OpenGraph, Twitter cards, canonical.
- **Technical:** `robots.ts`, `sitemap.ts`, semantic HTML, descriptive headings, alt text.

---

## 15. PPP Pricing (`src/lib/pricing/ppp.ts`)

- `PPP_FACTORS`: country → multiplier (ID 0.4, IN 0.35, CN 0.55, BR 0.5, MX 0.55, TR 0.45, VN 0.4, PH 0.45, TH 0.5, NG 0.35, etc.).
- `MIN_FACTOR` 0.35, `MAX_FACTOR` 1.0.
- `INELIGIBLE_COUNTRIES`: US, CA, GB, AU, SG, CH, NO, DK, SE, NL, AE, HK, JP, KR, IL, NZ, IE, AT, BE, FI, LU, DE, FR, ES, IT.
- `resolvePppPrice(price, country)` → `{ price, originalPrice, factor, eligible, currency }`.
- `roundToClean` → rounds to clean numbers (e.g., $9 → $3.60).

---

## 16. Money-Back Guarantee UX

- **30-Day Money-Back Guarantee** — unconditional refund within 30 days.
- Surfaced in: Footer trust strip, Pricing page guarantee section, Landing page guarantee section, checkout.
- Copy: "If HandicapLab doesn't give you a measurable edge, get a full refund within 30 days. No questions asked."

---

## 17. Free Trial UX

- **14-Day Free Trial, no credit card required.**
- Free tier: 3 picks/day visible, full dashboard, watchlist.
- Upgrade path: paywall gate → `/pricing` → Pro/Quant.
- Trial state persisted via `localStorage` (`handicaplab_user_tier`).

---

## 18. Accessibility (WCAG AA)

- **Contrast:** all text meets AA (4.5:1 body, 3:1 large). Semantic accents used on dark surfaces with sufficient contrast.
- **Focus:** visible `focus-visible` outlines on all interactive elements.
- **Reduced motion:** `prefers-reduced-motion` disables animations/pulse.
- **Semantic HTML:** `<nav>`, `<main>`, `<section>`, `<details>`, `<table>` with headers.
- **ARIA:** `aria-label` on icon-only controls, `aria-live` for dynamic metrics.
- **Keyboard:** all filters/toggles operable via keyboard.

---

## 19. Performance (95+ Lighthouse)

- **Server Components** by default; `'use client'` only where interactivity required.
- **Fonts:** `next/font` with `display: swap`, preloaded.
- **Images:** `next/image` with proper sizing; SVG icons (lucide) tree-shaken.
- **Caching:** static marketing pages, ISR for blog, client-side data fetching for dashboard.
- **Bundle:** route-level code splitting, minimal client JS on landing.
- **Metadata:** precomputed, no blocking render.

---

## 20. Implementation Roadmap

| Phase | Deliverables | Status |
|-------|--------------|--------|
| 1. Foundation | Design tokens, globals.css, layout, fonts | ✅ Done |
| 2. Navigation | Header, Footer, i18n selector | ✅ Done |
| 3. Landing | Full landing page + structured data | ✅ Done |
| 4. Pricing | PPP pricing, billing toggle, guarantee | ✅ Done |
| 5. Blog | Index + article + SEO | ✅ Done |
| 6. Dashboard | Bloomberg command center + overview ribbon | ✅ Done |
| 7. i18n | Message catalog (6 locales) | ✅ Done |
| 8. Verification | Build passes, route conflicts resolved | In progress |

---

## Verification Checklist

- [x] Route conflict between `/` (page.tsx) and `(marketing)/page.tsx` resolved
- [x] Design tokens in globals.css
- [x] Header/Footer with nav + i18n
- [x] Landing page all 13 sections
- [x] Pricing with PPP + toggle + guarantee
- [x] Blog index + article + SEO
- [x] Dashboard command center integrated
- [ ] `npm run build` passes
