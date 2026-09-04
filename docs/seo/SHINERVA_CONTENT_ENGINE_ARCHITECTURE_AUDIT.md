# SHINERVA CONTENT ENGINE — READ-ONLY FORENSIC ARCHITECTURE AUDIT

**Document Identifier**: `docs/seo/SHINERVA_CONTENT_ENGINE_ARCHITECTURE_AUDIT.md`  
**Audit Date**: September 4, 2026  
**Auditor**: Antigravity Quantitative Systems & Forensic Engineering Agent  
**Execution Gate**: GATE A — Read-Only Architectural Inspection (Execution Halt Applied)  
**Target Platform**: Shinerva (`https://shinerva.id`)  
**Inspected Repository**: `LANGGAM` (`shinerva-app` v1.0.0, Node 24.x, Vite + React SPA, Express serverless, Cloud Firestore, Cloudflare R2, Google Gemini 2.5 Audio & Text Architecture)  
**Active Workspace**: `HandicapLab` / Multi-Project Workspace

---

## 1. EXECUTIVE SUMMARY & MISSION ALIGNMENT

The objective of the **Shinerva Content Engine** is to build a continuously compounding, bilingual SEO and topical authority system for Indonesian AI Voice, Text-to-Speech (TTS), and digital content creator workflows.

### Non-Negotiable Invariants:
1. **Real Data Only**: Zero fabricated reviews, customer numbers, star ratings, or invented audio capabilities.
2. **Quality Over Word Count**: Substantive depth (700–1,500 words for standard guides; up to 2,000 words for technical pillars) without automated keyword stuffing or AI filler.
3. **Controlled Cadence**: Exactly **2 publishing events / week** (Tuesday & Friday at 09:00 WIB / 02:00 UTC), with an optional 3rd publishing event (Sunday 09:00 WIB) permitted only when pre-approved, quality-gated content exists.
4. **Bilingual Adaptation (Not Literal Translation)**: Each event can pair an Indonesian (`id-ID`) article with an English (`en`) localized adaptation sharing intent, facts, and structure while respecting native search queries.
5. **No Parallel Architecture**: Reuse existing production infrastructure, single canonical Firestore collections, existing admin auth, and avoid building competing schedulers or separate CMSs.

---

## 2. REPOSITORY & RUNTIME ARCHITECTURE INVENTORY

| Component | Current Implementation | Production Reality & Audit Findings |
|---|---|---|
| **App Framework** | Vite + React 18 SPA (`src/`) | Client-side rendered Single Page Application. Static files bundled to `dist/`. |
| **Backend Server** | Express 4.19 (`server.js` / `dist/server.mjs`) | Deployed to Vercel via Serverless Function wrapper (`api/index.js`). |
| **Database** | Google Cloud Firestore via `firebase-admin` 13.0 | Collections: `content`, `users`, `landing_pages`, `kb_articles`, `audit_logs`. |
| **AI LLM Engine** | `@google/genai` (Google Gemini 2.5 Flash) | API key via `GOOGLE_API_KEY`, circuit breaker with 15s timeout and backoff. |
| **TTS Synthesis** | Gemini 2.5 Flash Audio Preview & Google Cloud Chirp 3 HD | Free tier -> Chirp 3 HD; Paid tier -> Gemini 2.5 Flash Audio; Gemini 3.1 is disabled. |
| **Media & Storage** | Cloudflare R2 (`@aws-sdk/client-s3`) | S3-compatible endpoints for audio previews and uploaded CMS graphics. |
| **Authentication** | Firebase Auth + Custom Claims + Admin Email Whitelist | Handled by `authenticate` and `adminOnly` middleware (`server/middleware/adminOnly.js`). |
| **Hosting & CDN** | Vercel Edge (`vercel.json`) | Static files in `dist` served by Vercel CDN; `/api/(.*)` routed to serverless function. |
| **Analytics Engine** | GTM (`GTM-5CSSDF96`), GA4, PostHog, Microsoft Clarity | Unified through `src/lib/analytics.js` and canonical `growthEvents.js`. |

---

## 3. BLOG ROUTING & COMPONENT FORENSICS

### 3.1 Route Registrations (`src/main.jsx`)
The frontend registers 4 explicit blog routes:
- `/blog` — Indonesian blog index
- `/blog/:slug` — Indonesian article detail
- `/en/blog` — English blog index
- `/en/blog/:slug` — English article detail

All 4 routes resolve to `src/pages/Blog.jsx` wrapped in `React.Suspense` with a lazy import.

### 3.2 Component Analysis (`src/pages/Blog.jsx`)
1. **Dynamic Content Fetching**:
   - `Blog.jsx` calls `fetch('/api/content')` on mount.
   - If dynamic articles exist in Firestore, they are prepended to static constants:
     ```javascript
     const filteredStatic = PRODUCTION_BLOG_ARTICLES.filter(
       sp => !apiPosts.some(ap => ap.slug === sp.slug)
     );
     setPosts([...apiPosts, ...filteredStatic]);
     ```
2. **Markdown Block Parsing**:
   - A custom lightweight parser (`parseMarkdownBlocks`) parses `h2`, `h3`, `table`, `code`, `blockquote`, `ul`, `ol`, and `p`.
   - **CRITICAL DEFECT**: `parseMarkdownBlocks` **does NOT support markdown images (`![alt](url)`)**. Any image tag in markdown falls through to `<p>` rendering raw text.
3. **Interactive Table of Contents (TOC)**:
   - Extracted dynamically from `h2` and `h3` blocks, generating smooth anchor links.
4. **Social Sharing Assets**:
   - Renders 1-click copy cards for Instagram, Facebook, Threads, LinkedIn, TikTok, and Twitter snippets when provided.
5. **Conversion CTA Banner**:
   - Renders a conversion block driving traffic to `/#studio` (or `/en/#studio`) with `article_bottom_banner` tracking.

---

## 4. ARTICLE INVENTORY & STUB CONTENT AUDIT

An audit of all 23 articles in `src/constants/blogArticles.js` reveals an immediate SEO risk:

| # | Article Slug | Word Count (ID) | Word Count (EN) | Category | Audit Classification | Action Required |
|:---:|---|:---:|:---:|---|:---:|---|
| **1** | `best-ai-voice-generator-bahasa-indonesia` | **2,753** | **1,317** | AI Technology | **SUBSTANTIVE** | Keep indexable; ensure canonical matches language variant. |
| **2** | `what-is-text-to-speech-guide` | **85** | **126** | Guides | **THIN / STUB** | **NOINDEX** immediately until generated to 1,200+ words. |
| **3** | `ai-voice-vs-human-voice` | **101** | **119** | Industry Comparison | **THIN / STUB** | **NOINDEX** immediately until generated to 1,200+ words. |
| **4** | `best-ai-voice-for-youtube` | 10 | 11 | YouTube Strategy | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **5** | `ai-voice-for-tiktok-creators` | 12 | 11 | Social Media | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **6** | `ai-voice-for-podcasts-guide` | 12 | 10 | Podcasting | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **7** | `ai-voice-for-audiobooks-production` | 10 | 11 | Audiobooks | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **8** | `ai-voice-for-customer-service-automation` | 13 | 13 | Enterprise | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **9** | `ai-voice-for-elearning-accessible` | 9 | 9 | EdTech | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **10**| `ai-voice-for-digital-marketing` | 12 | 15 | Marketing | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **11**| `how-ai-voice-saves-business-money` | 12 | 11 | FinOps | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **12**| `how-to-create-voiceovers-without-recording`| 11 | 11 | Tutorials | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **13**| `how-to-build-faceless-youtube-channel` | 10 | 11 | YouTube Strategy | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **14**| `text-to-speech-api-developer-guide` | 11 | 11 | Developer API | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **15**| `speech-synthesis-explained-deep-dive` | 9 | 10 | AI Engineering | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **16**| `neural-tts-technology-explained` | 11 | 11 | AI Engineering | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **17**| `ai-voice-vs-traditional-voice-actors` | 12 | 12 | Industry Comparison | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **18**| `best-indonesian-ai-voices-langgam` | 11 | 13 | Brand & Voices | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **19**| `accessibility-with-ai-voice-solutions` | 11 | 11 | Accessibility | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **20**| `voice-ai-for-small-medium-enterprises` | 11 | 11 | SME Strategy | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **21**| `voice-ai-for-modern-education` | 11 | 11 | EdTech | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **22**| `future-of-ai-voice-synthesis-trends` | 11 | 10 | Future Trends | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |
| **23**| `complete-beginner-guide-to-ai-voice` | 12 | 13 | Beginner Guide | **EMPTY STUB** | **NOINDEX**; exclude from sitemap; draft via Content Engine. |

### Severity Assessment:
- **Critical Risk**: 20 of 23 articles are 1-sentence stubs (~10 words).
- **Listing Exposure**: The blog catalog at `/blog` displays all 23 cards to visitors and web crawlers.
- **Missing Noindex**: Neither `Blog.jsx` nor `useSeoMeta` injects `<meta name="robots" content="noindex, follow" />` on stub pages.

---

## 5. SITEMAP & ROBOTS.TXT ARCHITECTURE FORENSICS

### 5.1 Route Collisions in Express (`server.js`)
`/sitemap.xml` is registered **three separate times** in `server.js`:
1. **Line 583**:
   ```javascript
   app.get('/sitemap.xml', (req, res) => {
     const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
     if (fs.existsSync(sitemapPath)) {
       res.setHeader('Content-Type', 'application/xml; charset=utf-8');
       return res.sendFile(sitemapPath);
     }
     return res.status(404).send('Sitemap not found');
   });
   ```
2. **Line 2167**: Dynamic sitemap querying Firestore `content`.
3. **Line 4023**: Duplicate dynamic handler.

**Consequence**: Express evaluates routes in registration order. Line 583 intercepts all traffic and serves the static `public/sitemap.xml`. The dynamic generator at line 2167 is unreachable dead code.

### 5.2 Vercel Production Static Shadowing
In Vercel production:
- `vercel.json` defines `"outputDirectory": "dist"`.
- `npm run build` runs `vite build`, which copies `public/sitemap.xml` directly into `dist/sitemap.xml`.
- Vercel's edge CDN serves static files in `dist` immediately, bypassing serverless function execution entirely.
- **Current `public/sitemap.xml` contains ZERO blog articles**. Grep search for `/blog` in `public/sitemap.xml` yields 0 results.

### 5.3 Robots.txt (`public/robots.txt`)
`public/robots.txt` is well-formed:
- Allows: `/`, `/en/`, `/blog`, `/about`, `/docs`, and core programmatic landing pages.
- Disallows: `/api/`, `/dashboard`, `/admin`, `/creator`, `/payment/`.
- Declares: `Sitemap: https://shinerva.id/sitemap.xml`.

---

## 6. MULTILINGUAL, CANONICAL & HREFLANG FORENSICS

### 6.1 Language Architecture
Shinerva implements two language codes:
- Primary: Indonesian (`id-ID` / prefix ``)
- Secondary: English (`en-US` / prefix `/en`)

### 6.2 Flaws in Current Client Canonical Implementation
In `src/pages/Blog.jsx` line 100:
```javascript
const canonicalUrl = currentPost
  ? `https://shinerva.id${isEnglish ? '/en' : ''}/blog/${currentPost.slug}`
  : `https://shinerva.id${isEnglish ? '/en' : ''}/blog`;
```
When viewing the English article (`slug_en: 'best-ai-voice-generator-indonesian'`), `currentPost.slug` remains the Indonesian slug (`best-ai-voice-generator-bahasa-indonesia`). The canonical tag in English incorrectly outputs:
`https://shinerva.id/en/blog/best-ai-voice-generator-bahasa-indonesia` instead of using `slug_en`.

### 6.3 Flaws in Hreflang Generation (`src/lib/seoMeta.js`)
In `setHreflangTags`:
```javascript
const cleanUrl = currentUrl.split('?')[0].replace(/\/en(\/|$)/, '/');
const path = cleanUrl.replace('https://shinerva.id', '');
const idUrl = `https://shinerva.id${path}`;
const enUrl = `https://shinerva.id/en${path === '/' ? '' : path}`;
```
This naive string substitution assumes identical slugs across languages. For articles with localized slugs (e.g. `/blog/cara-membuat-voice-over-ai` vs `/en/blog/how-to-create-ai-voiceover`), this generates **404 cross-language alternates**, causing Googlebot indexing errors.

### 6.4 Flaws in LanguageSwitcher Component
In `src/components/LanguageSwitcher.jsx`:
Slug translation is hardcoded for exactly 1 article:
```javascript
if (code === 'EN') {
  if (currentPath === '/blog/best-ai-voice-generator-bahasa-indonesia') {
    newPath = '/en/blog/best-ai-voice-generator-indonesian';
  }
}
```
All other articles lack dynamic slug switching.

---

## 7. STRUCTURED DATA & RESIDUAL SCHEMA REPUTATION AUDIT

### 7.1 Good Practices Found
`src/pages/Blog.jsx` implements valid `Article` schema with:
- Canonical `mainEntityOfPage`
- Explicit `inLanguage` (`id-ID` or `en-US`)
- Real organizational authorship: `"Shinerva Editorial Team"`
- Valid publisher logo and `datePublished`

### 7.2 Critical Vulnerability: Residual Fake Reviews (`AggregateRating`)
Despite the previous SEO remediation, **fake review schemas still linger in 4 locations**:
1. `index.html` (Line 96): `"aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "120" }`
2. `src/pages/MarketingLanding.jsx` (Line 112): `aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '240' }`
3. `server/lib/schemas/softwareAppSchema.js` (Line 34): `aggregateRating: { '@type': 'AggregateRating', ... }`
4. `growth/seo/seoEngine.ts` (Lines 292 & 413): `aggregateRating` definitions.

**Verdict**: Must be purged immediately in Gate B to protect domain reputation in Google Search Console.

---

## 8. SCHEDULER & CRON INFRASTRUCTURE AUDIT

1. **Current Scheduling Endpoint**:
   - `POST /api/admin/content/:slug/schedule` (`server.js:2692`) verifies `approved === true`, converts target date to millisecond timestamp, and updates Firestore document with:
     ```javascript
     { status: 'scheduled', scheduledAt: timestampMs, publishDate: timestampMs }
     ```
2. **Missing Execution Loop**:
   - **There is NO background worker, cron task, or scheduler daemon** in production that queries `status == 'scheduled'` where `scheduledAt <= Date.now()` to update `status -> 'published'`.
   - Scheduled articles currently remain in `'scheduled'` indefinitely unless manually published.
3. **Timezone Policy**:
   - Canonical schedule is **09:00 WIB (Asia/Jakarta)** = **02:00 UTC**.
   - Cron jobs must trigger on UTC serverless runtimes using `0 2 * * 2,5` (Tuesday & Friday at 02:00 UTC).

---

## 9. DATABASE SCHEMA & CMS STORAGE AUDIT

1. **Firestore Collections**:
   - Canonical collection for blog articles in `server.js` and `server/lib/content/`: **`content`**.
   - Document ID: Canonical URL slug (e.g. `content/cara-membuat-voice-over-ai`).
   - Revision history subcollection: `content/{slug}/revisions/{revId}`.
2. **Data Model (`server/lib/content/contentModel.js`)**:
   - Fields: `slug`, `title`, `description`, `content`, `status`, `primaryKeyword`, `secondaryKeywords`, `cluster`, `searchIntent`, `funnelStage`, `author`, `seoTitle`, `seoDescription`, `canonicalUrl`, `approved`, `approvedAt`, `approvedBy`, `scheduledAt`, `publishedAt`, `qaScore`, `factualityStatus`, `indexable`, `wordCount`.
3. **Collection Discrepancy Flag**:
   - `growth/seo/seoEngine.ts` queries collection `'blog_posts'`.
   - `server.js` queries collection `'content'`.
   - Standardizing on `'content'` is mandatory.

---

## 10. PRODUCT FACTS SOURCE & AI GENERATION AUDIT

1. **Truth Registry (`server/lib/content/shinervaProductFacts.js`)**:
   - Defines verified product facts: 6 Langgam voices (*Sambas, Genta, Bening, Damai, Sekar, Rendra*), 1.500 free Voice Credits, 30-day rollover, QRIS/IDR pricing, prohibited claims.
2. **QA Scorer (`server/lib/content/contentQaEngine.js`)**:
   - Evaluates drafts on 6 dimensions (100 pts total): Factuality (25), SEO (20), Depth (20), Readability (15), Localization (10), Conversion (10).
   - Hard rejection rules: Instant fail if hallucinated voice names, fake user counts, or fake reviews are detected.
3. **AI Content Generator (`server/lib/content/contentAiGenerator.js`)**:
   - Grounded prompt injection reading directly from `SHINERVA_PRODUCT_FACTS`.
   - Missing item: Token/budget tracking (`MAX_ARTICLE_AI_COST`).

---

## 11. AUDIT SUMMARY SCORECARD & ACTION REGISTER

| Inspection Area | Current Status | Finding / Defect | Remediation Phase |
|---|:---:|---|:---:|
| **Blog Routing** | 🟢 PASS | Clean `/blog`, `/blog/:slug`, `/en/blog`, `/en/blog/:slug` routes. | Gate B |
| **Existing Articles** | 🔴 FAIL | 20 stub articles (~10 words) exposed to crawlers without `noindex`. | Gate B (P0) |
| **Markdown Rendering** | 🟡 WARN | Missing image tag rendering (`![]()`) in `Blog.jsx`. | Gate B |
| **Sitemap Serving** | 🔴 FAIL | Route collision in `server.js`; static `sitemap.xml` has 0 blog URLs. | Gate B (P0) |
| **Canonical / Hreflang**| 🔴 FAIL | Broken hreflang mapping across localized slugs; English canonical bug. | Gate B (P0) |
| **Structured Data** | 🔴 FAIL | Fake `aggregateRating` still present in 4 files. | Gate B (P0) |
| **Scheduler Daemon** | 🔴 FAIL | Schedule endpoint exists, but no automated cron publishes articles. | Gate D |
| **Content QA Engine** | 🟢 PASS | 6-dimensional evaluation, 85 pt threshold, factuality verification. | Complete |
| **Product Grounding** | 🟢 PASS | Canonical `SHINERVA_PRODUCT_FACTS` defined with prohibited claims. | Complete |
| **Admin Control Center**| 🟡 WARN | Editor exists, but lacks unified 26-week calendar & queue view. | Gate C |
| **Cost Safeguards** | 🟡 WARN | AI generator lacks per-article token budget ceiling. | Gate C |

---

**AUDIT CONCLUSION**: The core data structures, product facts, and QA foundations are in place. However, before publishing any new automated articles, the system requires resolution of the P0 SEO vulnerabilities: adding `noindex` to stubs, eliminating lingering `aggregateRating`, correcting the sitemap generation and delivery pipeline, fixing the bilingual hreflang/canonical logic, and wiring a secure, idempotent cron publishing worker.

**AUDIT COMPLETE — EXECUTION HALTED FOR USER APPROVAL.**
