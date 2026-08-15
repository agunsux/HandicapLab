# CANONICAL FOOTBALL DATA & ODDS PROVIDER AUDIT REPORT

**Date:** 2026-08-15T09:39:44Z  
**Type:** READ-ONLY-FIRST AUDIT & CONTROLLED ARCHITECTURE CANONICALIZATION  
**Status:** `RED — BLOCKED (Locally) / CONFIGURED (Vercel Production)`  
**Auditor:** Automated Diagnostic Suite (`npm run verify:providers`)  

---

## EXECUTIVE SUMMARY

HandicapLab has strictly unified its data provider layer onto two and only two canonical providers:

1. **API-Football (`https://v3.football.api-sports.io`)** — Single Source of Truth for fixtures, teams, competitions, results, and football metadata.
2. **OddsPAPI.io (`https://api.oddspapi.io`)** — Single Source of Truth for real-time and pre-match market odds.

All competing, legacy, or dead providers (The Odds API, FootyStats, TheStatsAPI, and `api.oddspapi.com/v1` `x-api-key` header schemes) have been disabled and purged from active production paths.

---

## 1. API-FOOTBALL AUDIT

| Dimension | Verification Evidence |
|---|---|
| **Credential (Env Var)** | `APIFOOTBALL_KEY` / `API_FOOTBALL_KEY` |
| **Vercel Production** | **PRESENT (Encrypted)** — Verified via `vercel env ls` (configured 17 days ago) |
| **Local Environment** | **EMPTY** — Vercel CLI redacts encrypted secrets in `.env.production.pull` to `""` |
| **Base URL** | `https://v3.football.api-sports.io` |
| **Authentication Scheme** | Header: `x-apisports-key: <key>` |
| **Client Module** | [`src/lib/data/providers/apiFootball/client.ts`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/lib/data/providers/apiFootball/client.ts) & [`src/lib/apis/apifootball.ts`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/lib/apis/apifootball.ts) |
| **Quota Status** | 100 requests/day free tier (10 req/min) |
| **Health Check Endpoint** | [`src/app/api/providers/health/route.ts`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/app/api/providers/health/route.ts) |

---

## 2. ODDSPAPI.IO AUDIT

| Dimension | Verification Evidence |
|---|---|
| **Credential (Env Var)** | `ODDS_PAPI_KEY` (Canonical — legacy `ODDSPAPI_KEY` fallbacks purged) |
| **Vercel Production** | **PRESENT (Encrypted)** — Verified via `vercel env ls` (configured 17 days ago) |
| **Local Environment** | **EMPTY** — Vercel CLI redacts encrypted secrets in `.env.production.pull` to `""` |
| **Canonical Base URL** | `https://api.oddspapi.io/v4` (Host: `https://api.oddspapi.io`) |
| **Authentication Scheme** | Request Parameter: `?apiKey=<ODDS_PAPI_KEY>` |
| **Deprecated Base URLs Purged** | `https://api.oddspapi.com/v1` removed from `api.ts`, `providerRegistry.ts`, and `config.ts` |
| **Client Module** | [`src/lib/data/providers/odds/native/client.ts`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/lib/data/providers/odds/native/client.ts) & [`src/lib/data/providers/odds/client.ts`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/lib/data/providers/odds/client.ts) |

---

## 3. SHARP BOOKMAKERS VERIFICATION

| Bookmaker | Target Availability | Provider Enum Key | Status |
|---|---|---|---|
| **Pinnacle** | PRIMARY SHARP BENCHMARK | `pinnacle` | `UNKNOWN` (Local credentials redacted) |
| **Circa** | SECONDARY BENCHMARK | `circasports` | `UNKNOWN` (Local credentials redacted) |
| **SBO / SBOBET** | SECONDARY BENCHMARK | `sbobet` | `UNKNOWN` (Local credentials redacted) |

*Bookmakers verified against native OddsPAPI v4 schema definitions in `src/lib/data/providers/odds/native/schemas.ts`.*

---

## 4. MARKET COVERAGE VERIFICATION

| Market | OddsPAPI Key | Canonical Market Id | Status |
|---|---|---|---|
| **Moneyline (1X2)** | `h2h` | `101` | `UNKNOWN` (Local credentials redacted) |
| **Asian Handicap** | `spreads` | `108` | `UNKNOWN` (Local credentials redacted) |
| **Over/Under** | `totals` | `106` | `UNKNOWN` (Local credentials redacted) |
| **BTTS** | `btts` | `114` | `UNKNOWN` (Local credentials redacted) |

---

## 5. API-FOOTBALL ↔ ODDSPAPI LINKAGE

| Metric | Result | Note |
|---|---|---|
| **Fixtures Tested** | 0 | Pending live decrypted API key execution |
| **Matched** | 0 | Deterministic string normalization in place (`normalizeTeam`) |
| **Unmatched** | 0 | Linkage gate strictly enforces 100% match rate |
| **Match Rate** | `N/A` | Synthetic matching forbidden |

---

## 6. DATABASE REAL VS SYNTHETIC AUDIT

| Layer | Row Count | Source | Integrity Classification |
|---|---|---|---|
| `data/EPL/*.csv` | 2,282 rows | Football-Data.co.uk | **REAL** (Historical ground truth 2020–2026) |
| `odds_snapshots` | 1,040 rows | Supabase staging | **SYNTHETIC** (Aug 4 run pre-match test data) |
| `wh_closing_lines` | 0 rows | Production warehouse | **PENDING** (Awaiting live OddsPAPI cron ingestion) |
| `matches` | 495 rows | Discovery pipeline | **METADATA ONLY** (0 attached match results) |

> [!CAUTION]
> The 1,040 synthetic rows in `odds_snapshots` must never be used as evidence for C3 validation or betting strategy backtests. Only live OddsPAPI ingested closing lines qualify for production research.

---

## 7. CANONICAL PROVIDER ARCHITECTURE

```text
┌─────────────────────────────────────────────────────────────┐
│                       HandicapLab                           │
│                Data Provider Architecture                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │     API-Football     │        │     OddsPAPI.io      │
    │ (api-sports.io v3)   │        │ (api.oddspapi.io v4) │
    └──────────┬───────────┘        └──────────┬───────────┘
               │                               │
        x-apisports-key                     ?apiKey=
               │                               │
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │ Canonical Fixtures / │        │  Real Sharp Markets  │
    │ Results / Metadata   │        │ (ML, AH, O/U, BTTS)  │
    └──────────┬───────────┘        └──────────┬───────────┘
               │                               │
               │                               ▼
               │                    ┌──────────────────────┐
               │                    │ Pinnacle / Circa /   │
               │                    │ SBOBET Bookmakers    │
               │                    └──────────┬───────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
               ┌───────────────────────────────┐
               │    Deterministic Entity       │
               │       Linkage Engine          │
               └───────────────┬───────────────┘
                               ▼
               ┌───────────────────────────────┐
               │     Production Warehouse      │
               │   (wh_fixtures, wh_closing)   │
               └───────────────────────────────┘
```

---

## 8. FINAL STATUS

```text
RED — BLOCKED (Locally)
```

**Rationale:**
1. **Architectural canonicalization:** Complete and verified (100% tests pass, build succeeds).
2. **Provider isolation:** All competing odds providers (The Odds API, FootyStats) purged from active paths.
3. **Execution gate:** Neither `APIFOOTBALL_KEY` nor `ODDS_PAPI_KEY` is present in local `.env` files (encrypted on Vercel Production).
4. Per DoD and governance invariants, **status remains RED until live authentication and real data retrieval are executed with valid credentials**.

---

## COMMAND TO RE-RUN AUDIT

```bash
npm run verify:providers
```
