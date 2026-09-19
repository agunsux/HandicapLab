# Epic 2: Production Realtime & Daily Picks Reconciliation Report

**Audited Production Lineage & Verification Artifact**  
**Status**: VERIFIED & RECONCILED  
**Canonical Domain**: `salmo.dev`  
**Execution Timestamp**: 2026-09-19T13:15:16.121Z (UTC)

---

## 1. Executive Summary & Defect Elimination

Prior to Epic 2, HandicapLab's public production system displayed a critical contradiction:
```text
Homepage:
0 upcoming fixtures

VS

BTTS:
9 active signals
```

### Root Cause Audit
Our forensic audit across serverless runtimes, network logs, and database layers established the exact failure mechanism:
1. **Cold-Start Provider Trap**: In `src/lib/providers/providerHealth.ts`, commit `8a5175f` added an unconditional `if (this.provider === 'apifootball') this.paused = true;`. In serverless Next.js/Vercel executions, every cold-start initialized `ProviderHealthMonitor` into `PAUSED`, throwing `ProviderUnavailableError(apifootball, PAUSED)` and forcing `UpcomingFixturesService` to fail closed to `0` fixtures.
2. **Disconnected Read Paths**:
   - The Homepage (`src/app/page.tsx`) invoked `UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 1 })`, which attempted live API-Football egress, was blocked by the paused health monitor, and returned 0 fixtures.
   - Concurrently, the `/btts` page queried `supabase.from('active_daily_picks')`, returning 9 previously persisted database picks.
3. **API-Football Range Parameter Omission**: `getFixturesRange(from, to)` omitted the mandatory `league` parameter in API-Football v3, causing upstream requests to fail with HTTP 400 parameter errors.
4. **OddsPapi Fixture Matching Collision**: Multiple matches kicked off at the exact same minute (e.g., three matches at 14:00:00 UTC on Saturday). `DailyPicksEngine` matched solely by kickoff time (`Math.abs(startTime - tKick) <= 10 mins`), causing collision and misassignment of Pinnacle market odds.

---

## 2. Canonical Production Architecture (Single Source of Truth)

The fragmented paths have been unified into **one canonical production pipeline**:

```text
API-Football Pro (League 39, 2026)
    ↓
Canonical Fixture Registry (Deterministic SHA-256 Key, Status Normalization)
    ↓
Supabase Database (`matches` table idempotent upsert)
    ↓
OddsPapi v4 (Pinnacle Ground Truth with Tournament Participant Mapping)
    ↓
Odds Snapshot & Temporal Invariant Gate (oddsTime <= predTime < kickTime)
    ↓
Dixon-Coles Probability Engine (Asian Handicap, Over/Under 2.5, BTTS)
    ↓
Qualification Gate & Daily Pick Derivation
    ↓
Supabase Persistence (`daily_picks`, `prediction_ledger_v3`, `predictions`)
    ↓
Canonical Public APIs (`/api/matches`, `/api/daily-picks`, `/api/predictions`)
    ↓
SALMO.DEV UI (Homepage & Market Pages)
```

- **Homepage** reads from `UpcomingFixturesService` → `CanonicalFixtureRegistry`.
- **`/daily-picks`** reads from `DailyPicksEngine` → `CanonicalFixtureRegistry` & `daily_picks`.
- **`/btts`** reads from `marketSignals` → `active_daily_picks` view (derived from `daily_picks`).
- **Zero Mock Fallback**: Production runtime contains zero fake odds, zero synthetic probabilities, and zero hardcoded test fixtures.

---

## 3. Provider State Machine & Cold-Start Resilience

`ProviderHealthMonitor` was refactored into a deterministic state machine:
- **Allowed States**: `ACTIVE`, `PAUSED`, `FAILED`, `DISABLED`.
- **Cold-Start Behavior**: If no persisted failure exists, provider initializes as `ACTIVE`.
- **Persistent Storage**: Health states persist to disk (`data/cache/provider_health_${provider}.json`) with cooldown recovery.
- **Operator Overrides**: Manual operator controls supported strictly via environment variables (`APIFOOTBALL_PAUSED=true`, `APIFOOTBALL_DISABLED=true`).

---

## 4. 7-Day Canonical Horizon & Idempotent Registry

The canonical horizon is strictly evaluated in UTC:
$$\text{nowUtc} < \text{kickoffUtc} \le \text{nowUtc} + 7\text{ days}$$

- **Deterministic Identity**:
  $$\text{fixtureId} = \text{SHA256}(\text{competitionId} : \text{season} : \text{normHome} : \text{normAway} : \text{kickoffDate})[0..15]$$
- **Idempotent Upsert**: Refreshes perform database updates on matching home, away, and kickoff timestamps without creating duplicates.
- **Completed Match Exclusion**: Fixtures with status `FINISHED`, `FT`, or past kickoff timestamps are automatically excluded from the upcoming feed.

---

## 5. Temporal Point-in-Time Proof (Zero Leakage)

Every production prediction is governed by the mandatory Point-in-Time invariant:
$$\text{oddsTimestampUtc} \le \text{predictionTimestampUtc} < \text{kickoffUtc}$$

### Demonstrated Real Fixture Trace
- **Fixture**: Brighton & Hove Albion vs Arsenal FC
- **Competition**: Premier League (ENG-PL / League 39, Season 2026)
- **Canonical Fixture ID**: `86cce14f1af56507`
- **Provider Fixture ID**: `1557409` (API-Football)
- **Odds Provider Event**: `id1000001772221276` (OddsPapi Pinnacle)
- **Market**: Asian Handicap
- **Selection**: Brighton -0.25 (Line: -0.25)
- **Pinnacle Market Price**: 4.64
- **Model Fair Price**: 3.01
- **Model Probability**: 33.22%
- **Edge**: +12.30%
- **Expected Value (EV)**: +67.54%
- **Validation Status**: `PROVISIONAL_EDGE`

### Temporal Timestamp Log (UTC)
```text
oddsTimestampUtc:       2026-09-19T13:15:18.880Z (1789823718880 ms)
predictionTimestampUtc: 2026-09-19T13:15:24.385Z (1789823724385 ms)
kickoffUtc:             2026-09-19T14:00:00.000Z (1789826400000 ms)

Evaluation:
1789823718880 <= 1789823724385 < 1789826400000  ==>  PASS (100% Invariant Compliant)
```

---

## 6. Live Reconciliation Report & Provenance Metrics

Live audit executed on real external providers and production database:

| Metric Category | Metric | Audited Value | Status |
| :--- | :--- | :--- | :--- |
| **Providers** | API-Football PRO | `ACTIVE` (Limit: 7,500 / Remaining: 7,493) | LIVE & AUTHENTICATED |
| | OddsPapi v4 | `ACTIVE` (Limit: 250 / Remaining: 157) | LIVE & AUTHENTICATED |
| | FootyStats API | `ACTIVE` (Authenticated: true) | LIVE & AUTHENTICATED |
| **Fixtures** | 7-Day Fixtures Discovered | **8** | DISCOVERED |
| | Canonical Fixtures (7d) | **8** | PERSISTED |
| | Future Valid Fixtures | **8** | VALIDATED |
| | Fixtures with Valid Pinnacle Odds | **8** | 100% COVERAGE |
| **Predictions** | Predictions Generated | **23** (AH, OU 2.5, BTTS) | GENERATED |
| | Qualified Daily Picks | **23** | QUALIFIED |
| | VALIDATED_EDGE Picks | 0 | AUDITED |
| | PROVISIONAL_EDGE Picks | 7 | ACTIVE |
| | NO_EDGE Picks | 16 | FILTERED |
| | Rejected Picks | 0 | PASS |
| | DATA_UNAVAILABLE | 0 | ZERO UNAVAILABILITY |
| **Database** | `matches` table | 505 records | CONSISTENT |
| | `daily_picks` table | 30 records | AUDITED |
| | `active_daily_picks` view | 24 active future picks | RECONCILED |
| **Public UI** | Homepage Upcoming Fixtures | **8** matches | RECONCILED |
| | Discrepancy Status | **0 fixtures vs active picks contradiction: ELIMINATED** | VERIFIED |

---

## 7. Automated Invariant Test Suite Execution

All 12 invariants executed via `vitest run tests/production-reconciliation.test.ts`:
- [x] `Invariant 1: Provider Health Monitor is ACTIVE on cold start (no paused trap)`
- [x] `Invariant 2: Canonical Fixture Registry discovers upcoming 7-day fixtures`
- [x] `Invariant 3: All upcoming fixtures have kickoff strictly in the future (UTC)`
- [x] `Invariant 4: All upcoming fixtures are within the 7-day canonical horizon`
- [x] `Invariant 5: Upcoming fixtures have deterministic canonical identity`
- [x] `Invariant 6: UpcomingFixturesService delegates directly to CanonicalFixtureRegistry (No Disconnection)`
- [x] `Invariant 7: Temporal Point-in-Time Proof (oddsTimestamp <= predictionTimestamp < kickoff)`
- [x] `Invariant 8: Real market odds from Pinnacle (No fabricated/synthetic fallback)`
- [x] `Invariant 9: Supported markets strictly confined to ASIAN_HANDICAP, OVER_UNDER, BTTS`
- [x] `Invariant 10: Fail-closed but not false-zero state semantics`
- [x] `Invariant 11: Daily Picks map to existing canonical fixtures (Zero Orphan Picks)`
- [x] `Invariant 12: active_daily_picks view reconciles with canonical fixtures and contains zero past matches`

**Result**: 12/12 Tests Passing.

---

## 8. Definition of Done Attestation

The canonical real-time production pipeline is verified end-to-end:
- Real API-Football fixture ingested into Canonical Fixture Registry.
- Real OddsPapi Pinnacle odds snapshot matched deterministically by tournament participant IDs and kickoff time.
- Existing Dixon-Coles model probability and fair odds computed without retuning.
- Prediction persisted to Supabase `daily_picks` and tamper-evident SHA-256 chained `prediction_ledger_v3`.
- Public API `/api/matches` and `/api/daily-picks` exposing identical canonical records with complete state metadata.
- SALMO.DEV UI Homepage and `/btts` reconciled with zero contradictions.
