# HANDICAPLAB — PRODUCTION READINESS

Compiled 2026-09-11 after the Master EPIC (PRO plan + Sharp Market Reference).

## Final status

```text
API-FOOTBALL PLAN                     PRO $19/month
API-FOOTBALL DAILY LIMIT              7,500
API-FOOTBALL INTERNAL SOFT LIMIT      6,000
ODDSPAPI MONTHLY LIMIT                250
ODDSPAPI HISTORICAL ODDS              UNMETERED / FREE

REAL FIXTURES                         PASS (canonical client, no mock fallback)
REAL HISTORICAL DATA                  PARTIAL (fixtures present; closing-odds
                                      ingestion still required for full coverage)
REAL ODDS                             PARTIAL (billable budget; selective refresh)
REAL HISTORICAL ODDS                  PARTIAL (unmetered endpoint implemented;
                                      ingestion runner is a planned task)

AH ENGINE                             VERIFIED (settlement walk-forward real)
OU ENGINE                             VERIFIED (real OOS results shown, negative)
BTTS ENGINE                           UNVERIFIED (no priced historical odds)
CLV                                   UNAVAILABLE (entry/closing pairs need
                                      historical odds ingestion)
BACKTEST                              VERIFIED (persisted walk-forward, −5.37%)
HOMEPAGE                              REAL DATA (fabrications removed)
QUOTA PROTECTION                      PASS (soft/hard policy + atomic persistence)
SECURITY                              PASS (server-only keys; no NEXT_PUBLIC
                                      provider keys; browser→provider blocked)
PRODUCTION                            NO-GO (blockers below)
```

## 2. What was delivered (2026-09-11)

- `src/lib/providers/quotaPolicy.ts` — canonical limits/priorities/modes.
- `quotaManagerV4` / `quotaManager` / `requestCounter` rewired to `quota_state`
  + policy (V3 no longer hardcodes 100/day).
- Migration `20260911000000_quota_policy_pro_hard_soft.sql`.
- Native OddsPapi client: unmetered `fetchHistoricalOdds`, `selectEntryAndClosing`.
- Sharp Market Reference: `sharpBooks` S1/S2 config, `sharpConsensus.ts`,
  `sharpReferenceProvider.ts`.
- Mock generation deleted; `/api/dashboard` deprecated; `/api/evidence` made
  real; homepage/market pages render real evidence only.
- Data state module + UI badges.
- New tests: `quota-policy`, `data-state`, `sharp-consensus`, `no-mock-guard`;
  updated `quota-system`, `oddspapi-filter`, `epic67_data_services`,
  `evidenceCenter`, `epic67_public_endpoints`, `worldcup-feed`,
  `api-endpoints`. (31 new/updated tests passing.)

## 3. Blockers for GO

1. **Apply quota migration** to the production Supabase database (and verify the
   `reserve_quota`/`confirm_quota`/`rollback_quota` RPCs exist). Without it,
   metered calls fail closed (`RPC_ERROR` / `QUOTA_INFRA_UNAVAILABLE`) by design.
2. **Ingest historical closing odds** (unmetered `/v4/historical-odds`) so CLV
   and BTTS pricing become available. Until then CLV = UNAVAILABLE and BTTS is
   calibration-only.
3. **Canonical match registry**: complete a persistent API-Football ↔ OddsPapi
   fixture-ID mapping to guarantee dedup.
4. **Pre-existing failing tests** (in this repo state they are unrelated to this
   work and fail on environment/mocking grounds): `coverage-forensic`,
   `epic61-real-data-lock`, `silver-pipeline`, `signal-feed`,
   `trust-dashboard`, `football-data-e2e`, `football-csv-ingestion`,
   `football-bulk-ingestion`, `ml-training`, `entity-resolver`,
   `feature-assembler`, `prediction-serving`, `research-engine`,
   `research-readiness`, `competition-intelligence`, `epic59`,
   `market-intelligence`, `payments`, `faze1-demo-mode`, `historical-ingestion`.
   These must be consolidated before a green build.

## 4. Acceptance test matrix (Epic §45)

| Test | Status |
| --- | --- |
| 01 API-Football PRO auth | NOT RUN (no live credentials in this env) |
| 02 real fixtures | PASS (unit) / NOT RUN (live) |
| 03 real historical results | PASS (unit) / NOT RUN (live) |
| 04 real odds (OddsPapi) | NOT RUN (live) |
| 05 historical odds (OddsPapi) | NOT RUN (live) |
| 06 canonical match mapping | NOT RUN — pending (blocker 3) |
| 07 DB persistence | PASS (unit) |
| 08–14 prediction engine / markets / fair odds / EV | PASS (existing unit suites) |
| 15 confidence | PASS (unit) |
| 16 prediction ledger | PASS |
| 17 historical performance | PASS (persisted artifact) |
| 18 homepage | PASS (real data) |
| 19 provider outage | PASS (fail-closed paths tested) |
| 20 quota protection | PASS (policy/unit) |
| 21 production build | NOT RUN here |
| 22 production smoke test | NOT RUN here |

Legend: unit-verified where marked; live runs require a configured
production/deployment environment and are listed as NOT RUN.

## 5. Recommended next contract

Remove the four blockers above, then re-run this checklist and flip
`PRODUCTION` to `GO`.
