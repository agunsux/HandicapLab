# PHASE 0 — FORENSIC LOCK (2026-08-10)
Inventory of every mock / test / hardcoded / leakage / broken path. **No data modified.**

## 1. MOCK PATHS (can reach production)
| Path | Type | Reaches production? |
|---|---|---|
| `src/lib/mockData.ts` — mockAccuracyStats (68.55% 1X2 etc.), mockMatchesAndPredictions | static mock | YES — `src/app/app/matches/page.tsx` fallback (current DB state triggers it); `src/components/AccuracyStats.tsx` (component exists, not rendered in current app pages) |
| `src/lib/api/providers/mockProvider.ts` (DATA_PROVIDER=mock) | mock provider | only if env set (DATA_PROVIDER empty in env files → inactive) |
| `src/lib/api/apiFootball.ts` `generateMockResponse` (key='mock') | mock client | only if key='mock' (real key set → inactive) |
| `src/services/backtestService.ts` — injects 5 mock matches + mock probabilities + `closingOdds = homeOdds × 0.98` (mock CLV drift) | fabricated backtest | **YES — POST /api/backtest/run** (current DB has no finished matches → mock path always taken) |
| `src/lib/replay/MockReplayDataProvider.ts` | replay-only | no (test tooling) |
| `src/scripts/importFootballData.ts` — writes mock CSV (Man Utd vs Liverpool 2-1, B365H 2.10 / PSH 2.15) when file missing | mock import | **YES (historical) — source of the 2 junk `raw_matches` rows + 12 `raw_odds` rows** |

## 2. TEST-WRITE PATHS (wrote into production tables)
| Path | Effect |
|---|---|
| `src/scripts/validate-pipeline-2024.ts` | **Wrote all 1,040 synthetic `odds_snapshots`** (hardcoded 2.1/3.4/3.5 ML, 2.1/1.8 AH, 1.9/1.9 OU, 1.7/2.1 BTTS, bookmaker=pinnacle) + archived 372 matches + ran prediction cron → 490 synthetic predictions |
| `src/scripts/run_production_pipeline_test.ts` | hardcoded homeOdds 2.10 / 1.95 / 1.90 pattern (test) |
| `src/scripts/historical_ingester.ts` | CSV → `odds_snapshots` upserts (open/close) |
| `src/scripts/phase_b_live_probe.ts`, `controlled_single_fixture_probe.ts` | `raw_odds` writes (Bet365/Pinnacle 1X2) |
| `src/scripts/seed-*.ts`, `sprint1-seed-db.ts`, `settle-seed-mls.ts`, `test-*.ts`, `run-wc-pipeline.ts`, `backfill-*.ts` | seed/test writes |
| `src/scripts/epic59-*.ts` | forensic/replay scripts reading production tables |

## 3. HARDCODED / FALLBACK PATHS (predictions & EV)
| Path | Issue |
|---|---|
| `src/lib/data/prediction/engine.ts:41` `buildMatchInput` | strengths 0.5/0.5, xG 1.35/1.15, shots 12/10, SoT 4/3.5, form 0.5/0.5 — constants for every fixture |
| `src/lib/engines/feature-engine/form.ts` | no finished matches → `[]` → neutral default 1.5 |
| `src/lib/engines/feature-engine/xg.ts` | no finished matches → 1.0/1.0/2.5 defaults |
| `src/lib/engines/feature-engine/strength.ts` | no finished matches → ELO 1500/1500 |
| `src/lib/engines/probability-engine/index.ts` | Platt defaults (1.02, -0.01); competition profile defaults; `trainedAt`/`trainedOnMatches` hardcoded claims |
| `src/lib/crons/prediction.ts` `pickSelection` / odds read | selection fixed 'home'/'over'; odds from synthetic snapshots; missing → SKIP MISSING_ODDS (correct refusal, but odds never real) |
| `src/app/api/predictions/route.ts` | fallback odds 2.5/3.0/2.8, fallback probs 0.3/0.25/0.35; serves `prediction_ledger_v3` test rows ("Real test run", EV +21.8…+45.9%) |
| `src/app/api/value-intelligence/bets/route.ts` | `clvProjection = edge_pct × 0.65` (fabricated); serves synthetic daily_picks |
| `src/lib/data/providers/core/config.ts` | "OddsPapi" baseUrl = api.the-odds-api.com (The Odds API) — naming mismatch documented |

## 4. LEAKAGE PATHS
| Path | Issue |
|---|---|
| `validate-pipeline-2024.ts` → `runPredictionCron` | generates predictions for matches regardless of kickoff → **308/490 predictions generated after kickoff** |
| `src/scripts/validate-pipeline-2024.ts` odds insert | odds snapshots written 2026-08-04 for matches kicked off Jul 25-31 (post-kickoff odds) |
| `runPredictionCron` | processes status='upcoming' incl. stale rows (kickoff in past); no kickoff guard |
| `prediction_ledger_v3` | prediction_timestamp vs created_at mismatch; explainability labelled "Real test run" |

## 5. BROKEN / STUB PATHS
| Path | Issue |
|---|---|
| `ProviderOrchestrator.runStage2OddsCollection` | queries **non-existent `fixtures` table** (PostgREST 404) → stage fails |
| `ProviderOrchestrator.runStage4PredictionGeneration` | stub `{success:true}` |
| `ProviderOrchestrator.runStage5Settlement` | **stub — returns success, settles nothing** |
| `OddsPapiProvider` | key invalid (401) on api.oddspapi.io AND api.the-odds-api.com |
| `TheStatsProvider` | wrong routes → 404/500 |
| `FootballDataProvider` | placeholder key → 400 |
| `sharpOdds.ts` | btts market unsupported by The Odds API; key invalid anyway |
| `vercel.json` | schedules discovery/odds/enrichment/settlement/predict/update-results; settlement+predict paths broken as above; worldwide-scheduler / t60-snapshot / generate-signals NOT scheduled |

## 6. DATA SOURCE CLASSIFICATION (current production tables)
| Table | Class |
|---|---|
| `raw_matches` (2,282) | REAL — 2,280 EPL 2020-2026 (football-data.co.uk E0.csv, results+odds) + **2 junk rows (id 1-2) = MOCK** (from importFootballData mock CSV) |
| `raw_odds` (12) | MOCK (mock CSV import) |
| `odds_snapshots` (1,040) | SYNTHETIC (test script) |
| `predictions` (490) | SYNTHETIC (constant features + synthetic odds) |
| `prediction_ledger` (600) | REAL refusal records (SKIP MISSING_ODDS) — kept |
| `prediction_ledger_v3` (4) | TEST ("Real test run") |
| `daily_picks` (1,224) | SYNTHETIC-derived (synthetic odds) |
| `matches` (495) | REAL fixtures (API-Football) but **0 scores**; 372 archived by test script; league labels corrupted for some rows |
| `provider_logs` (495) | REAL operational log |

## 7. HISTORICAL ODDS PROVENANCE (for Phase 1)
- Source: football-data.co.uk `E0.csv` per season (bulk import, `raw_import_jobs.provider='Football-Data.co.uk'`).
- Parser mapping (backend FootballDataParser): Bet365 1X2 = B365H/D/A (**closing**), Pinnacle 1X2 = PSH/D/A (parser tags as closing; **actual E0 semantics: opening** — PSCH/PSCD/PSCA are closing) → CLV-capable only if closing columns re-imported; current raw_matches holds 1X2 + O/U 2.5 without opening/closing split → **treat as closing-market reference, CLV = NULL for now** (no opening prices persisted).
- Totals (over25/under25) source column not determinable from code (P>2.5/U>2.5 or B365 O2.5) — treated as O/U 2.5 closing reference.

## 8. ACTIONS TAKEN
None destructive. Phase 1 builds a NEW isolated gold layer (`src/historical/`, outputs under `data/historical/`) that consumes only the 2,280 REAL rows of `raw_matches`; mock/test/synthetic tables are excluded and flagged for later quarantine (source_type columns in migration).
