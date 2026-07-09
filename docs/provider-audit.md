# Provider Audit — Data Coverage Analysis

## Status: CRITICAL GAP — No Concrete Provider Implementations Exist

---

## Executive Summary

The current provider layer consists of **abstract interfaces only**. There are zero concrete implementations for API-Football, The Odds API, or any other provider. The shadow pipeline runs entirely on in-memory mock data.

**Sprint 4 Live Validation cannot begin with real data until provider implementations are built.**

---

## Phase 1 — Current Provider Implementation

| File | Type | Status |
|------|------|--------|
| `src/lib/data/providers/types.ts` | Interface definitions | ✅ Complete |
| `src/lib/data/providers/index.ts` | Barrel exports | ✅ Complete |
| `src/lib/data/providers/oddsProvider.ts` | Re-export only | ❌ No implementation |
| `src/lib/data/providers/fixturesProvider.ts` | Re-export only | ❌ No implementation |
| `src/lib/data/providers/resultsProvider.ts` | Re-export only | ❌ No implementation |

### Interfaces Defined (Not Implemented)

- `IFixturesProvider.fetchFixtures()`
- `IOddsProvider.fetchOdds()`
- `IOddsProvider.normalizeMarket()`
- `IResultsProvider.fetchResults()`

### Configuration

| Item | Status | Notes |
|------|--------|-------|
| API keys in .env | ❌ Missing | No .env file found |
| Provider configuration | ❌ Missing | No config object |

---

## Phase 2–3 — Coverage & Pipeline Eligibility

**Cannot be measured.** Without concrete provider implementations and API keys, no actual API calls can be made. The Shadow Pipeline cannot process any real fixtures until providers are built.

**Arsitektur final:**
- API-Football → fixtures, results, standings, lineups, statistics
- The Odds API → odds (Moneyline, Asian Handicap, Over/Under)
- Kedua provider independen, bukan hierarki primary/fallback


---

## Phase 4 — Coverage (Estimated from Documentation)

### The Odds API → PRIMARY ODDS SOURCE

| League | Moneyline (h2h) | Asian Handicap (spreads) | Over/Under (totals) |
|--------|:--------------:|:------------------------:|:-------------------:|
| EPL | ✅ | ✅ | ✅ |
| Bundesliga | ✅ | ✅ | ✅ |
| La Liga | ✅ | ✅ | ✅ |
| Serie A | ✅ | ✅ | ✅ |
| Ligue 1 | ✅ | ✅ | ✅ |
| Champions League | ✅ | ✅ | ✅ |
| Europa League | ✅ | ✅ | ✅ |
| Brasileirão | ✅ | ✅ | ✅ |
| Eredivisie | ✅ | ✅ | ✅ |
| Scottish Premiership | ✅ | ✅ | ✅ |

**Keunggulan**: Market coverage konsisten per sport key — semua tiga market tersedia untuk seluruh pertandingan dalam satu endpoint. Tidak ada "bolong" antar liga.

### API-Football → PRIMARY FIXTURE SOURCE (100+ leagues)

| Feature | Availability |
|---------|:-----------:|
| 100+ leagues | ✅ |
| Lineups | ✅ |
| Injuries | ✅ |
| xG / statistics | ✅ |
| Standings | ✅ |
| Head-to-head | ✅ |
| Moneyline | ⚠️ (tidak konsisten per liga) |
| Asian Handicap | ⚠️ (tidak konsisten per liga) |
| Over/Under | ⚠️ (tidak konsisten per liga) |

**Catatan**: API-Football tidak diandalkan untuk odds karena coverage per liga tidak seragam — beberapa liga tidak memiliki AH atau OU.


---

## Phase 5 — Cross-check

| Competition | API-Football | The Odds API | Football-Data.org |
|-------------|:-----------:|:------------:|:-----------------:|
| EPL | ✅ | ✅ | ✅ |
| Championship | ✅ | ✅ | ✅ |
| Bundesliga | ✅ | ✅ | ✅ |
| 2. Bundesliga | ✅ | ✅ | ❌ |
| La Liga | ✅ | ✅ | ✅ |
| La Liga 2 | ✅ | ❌ | ❌ |
| Serie A | ✅ | ✅ | ✅ |
| Serie B | ✅ | ❌ | ❌ |
| Ligue 1 | ✅ | ✅ | ✅ |
| Ligue 2 | ✅ | ❌ | ❌ |
| Eredivisie | ✅ | ✅ | ❌ |
| Primeira Liga | ✅ | ✅ | ❌ |
| J1 League | ✅ | ❌ | ❌ |
| K League | ✅ | ❌ | ❌ |
| Brasileirão | ✅ | ✅ | ❌ |
| Argentine Primera | ✅ | ❌ | ❌ |
| MLS | ✅ | ✅ | ❌ |
| Süper Lig | ✅ | ❌ | ❌ |

**API-Football has the widest league coverage.**

---

## Phase 6 — Gap Analysis

| Gap | Type | Impact | Resolution |
|-----|------|--------|------------|
| No concrete provider implementations | Software | BLOCKING | Build implementation classes |
| No API keys configured | Configuration | BLOCKING | Register for API keys |
| No .env file | Configuration | BLOCKING | Create .env |
| The Odds API lacks true AH odds | Provider limitation | HIGH | Use API-Football for AH, or find provider with true AH |
| No pagination handling | Software | MEDIUM | Implement pagination |
| No quota monitoring | Software | MEDIUM | Add quota tracking |
| No timezone normalization | Software | LOW | Add timezone handling |

### Software Bugs vs Provider Limitations

| Issue | Type |
|-------|------|
| No concrete provider class | Software bug |
| Missing .env configuration | Configuration bug |
| The Odds API spreads ≠ Asian Handicap | Provider limitation |
| API-Football 100 req/day free limit | Provider limitation |
| Football-Data.org has no odds | Provider limitation |

| Endpoint URLs | ❌ Missing | Not configured |
| Rate limit handling | ⚠️ Partial | `lib/retry.ts` exists |
| Timezone handling | ❌ Missing | Not configured |
| Pagination | ❌ Missing | Not implemented |
| Quota monitoring | ❌ Missing | Not implemented |

### Reusable Infrastructure

| Component | File |
|-----------|------|
| Retry with exponential backoff | `src/lib/retry.ts` |
| Structured JSON logger | `src/lib/logger.ts` |
| Retryable error codes (429, 503, 504) | `src/lib/retry.ts` |
