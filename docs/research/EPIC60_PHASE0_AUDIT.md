# EPIC 60 — PHASE 0 READ-ONLY RESEARCH AUDIT

**Execution Date:** 2026-08-26
**Auditor:** Kilo (read-only repository audit, no code modified)
**Proposed EPIC Name:** Market-Specific Probability Research (AH / O/U / BTTS)
**Proposed Status:** RESEARCH ONLY — SHADOW — EVIDENCE-FIRST

> ⚠️ **RENAMING NOTE (blocking):** The proposed name "EPIC 55" is **already taken** in this
> repository. Verified usage: EPIC 55 = Real Data UI / Production Truth Gate
> (`REAL_DATA_UI_ACCEPTANCE_REPORT.md`, `tests/real-data-ui.test.ts`), EPIC 56 = Live Shadow
> Evidence (`LIVE_SHADOW_REPORT.md`), EPIC 57 = Provenance Preflight
> (`PRODUCTION_PROVENANCE_GATE_REPORT.md`), EPIC 58 = Daily Picks / Quant Research Track
> (`research/quant/`), EPIC 59 = Historical E2E Pipeline Audit
> (`src/scripts/epic59-stage0-probe.ts`). This audit is therefore filed as **EPIC 60**.

**Evidence categories used in this report:**
`[OBSERVED]` = read directly from files/data in this audit · `[CLAIMED]` = stated in an
existing report, not independently re-verified · `[CALCULATED]` = computed by this audit ·
`[INFERENCE]` = interpretation · `[NOT AVAILABLE]` = does not exist in the repository.

---

## 1. Audit Items A–T (repository inventory)

| # | Item | Status | Evidence |
|---|---|---|---|
| A | Gold historical data source | **EXISTS — 2 generations** | `data/golden/europe/` (europe-dataset-v1, generated 2026-08-19, source football-data.co.uk) and legacy `data/historical/normalized_matches.jsonl` (2,280 matches, EPIC 53/54 warehouse) `[OBSERVED]` |
| B | Match result tables | **EXISTS** | `data/golden/europe/canonical_matches.jsonl` (7.7 MB, goals + resultVerified + btts/over flags); `data/historical/normalized_matches.jsonl` (833 KB) `[OBSERVED]` |
| C | Historical odds tables | **EXISTS (AH/OU/ML only)** | `data/golden/europe/market_odds.jsonl` (46.6 MB, 77,471 rows); **BTTS odds = 0 rows** `[CALCULATED]` |
| D | Odds timestamps | **DATE GRANULARITY ONLY** | `market_odds.jsonl` carries `match_date` + `observation: opening|closing`; no snapshot timestamps in historical gold `[OBSERVED]` |
| E | Fixture linkage | **EXISTS, two systems** | `canonical_id` in golden/europe (`LEAGUE\|season\|date\|home\|away`) + EPIC 53 `CanonicalEntityResolver` (API-Football ↔ OddsPAPI) `[OBSERVED]` |
| F | Provider/bookmaker identity | **EXISTS** | football-data.co.uk (historical, bookmaker_source: betbrain / pinnacle / avg); OddsPAPI live (Pinnacle, Circa, SBOBET) `[OBSERVED]` |
| G | Prediction snapshots | **EXISTS** | `data/historical/out_of_sample_predictions.jsonl` (6.3 MB), `odds_250_299_oos_predictions.jsonl` `[OBSERVED]` |
| H | Model registry | **EXISTS** | `model_registry.json` (naive-home-v1, elo-only-v1, poisson-only-v1, ensemble-platt-v1, ensemble-isotonic-v1, phase2a-baseline, …) `[OBSERVED]` |
| I | Feature store | **EXISTS** | `data/feature_store/`, `feature_registry.json`, `src/lib/engines/feature-engine/` `[OBSERVED]` |
| J | Replay engine | **EXISTS** | `tests/replay-production-adapter.test.ts` (ProductionPredictorAdapter) `[OBSERVED]` |
| K | Calibration engine | **EXISTS** | `src/lib/engines/probability-engine/calibration.ts` (platt / isotonic / beta / none) `[OBSERVED]` |
| L | Backtest / walk-forward engine | **EXISTS** | `src/services/backtestService.ts`, `src/lib/tournament/modelTournamentEngine.ts`, `data/golden/walk_forward/`, `data/walkforward/` `[OBSERVED]` |
| M | Settlement engine | **PARTIAL** | `src/historical/settlement/settlement.ts`: WIN / HALF_WIN / PUSH / HALF_LOSS / LOSS with half-step split. **VOID outcome type absent** in AH/OU settlement `[OBSERVED]` |
| N | De-vig engine | **EXISTS (canonical)** | `src/lib/settlement-core/devig.ts` (`removeVigProportional`); STATISTICAL_GOVERNANCE.md §2 `[OBSERVED]` |
| O | CLV engine | **EXISTS — with a formula discrepancy** | Governance §1.3: `mean(1/closing − 1/taken)×100`; `src/lib/shadow/liveShadowEngine.ts:82` uses `(entry_odds / closing_odds) − 1` (EPIC 54 convention) `[OBSERVED]` |
| P | EPIC 53 fixture-linkage gate | **EXISTS, PASSED** | `DATA_INTEGRITY_CHECKPOINT_REPORT.md` (10/10 linkage, synthetic isolation, bitwise anti-leakage test), migrations 47–49 `[OBSERVED]` |
| Q | EPIC 54 per-market diagnostic gate | **EXISTS, COMPLETE — with quality concerns** | `MODEL_TOURNAMENT_REPORT.md`, `src/lib/tournament/modelTournamentEngine.ts` — see §5 below `[OBSERVED]` |
| R | prematch-v1 implementation | **PARTIALLY VERIFIED** | `src/lib/engines/probability-engine/index.ts` (single blended Poisson+Dixon-Coles score matrix → ML, OU (line 183+), AH (line 206+); BTTS via `pBttsYes` in `ProbabilityOutput` summed from the same matrix). Registry entries `prematch-v1` not located in `model_registry.json` — registry holds other IDs; naming reconciliation needed `[OBSERVED]` |
| S | Statistical Governance | **EXISTS** | `STATISTICAL_GOVERNANCE.md` (adopted Epic 31A, updated 2026-07-15): canonical ROI/CLV/Brier/ECE/Edge, market-specific Brier, de-vig §2, feature-flag gating §6, ablation §8 `[OBSERVED]` |
| T | Experiment registry | **EXISTS** | `experiment_registry.json`, `feature_registry.json`, plus Python MLflow platform `research/quant/` (mlruns, research_ledger.jsonl, EPIC 58A/58A.5 audits) `[OBSERVED]` |

---

## 2. Gold Data Coverage — what actually exists

### 2.1 `data/golden/europe/` (europe-dataset-v1) `[OBSERVED]`

| League | Matches | Date range | AH odds cov. | OU odds cov. | BTTS odds cov. |
|---|---|---|---|---|---|
| ENG-PL | 4,180 | 2015-08-08 → 2026-05-24 | 99.98% | 100% | **0% (no odds rows)** |
| ESP-LALIGA | 1,520 | 2016-08-19 → 2020-07-19 | 99.87% | 100% | **0%** |
| DEU-BUNDESLIGA | 918 | 2016-08-26 → 2019-05-18 | 100% | 100% | **0%** |
| ITA-SERIEA | 1,140 | 2016-08-20 → 2019-05-26 | 100% | 100% | **0%** |
| FRA-LIGUE1 | 1,140 | 2016-08-12 → 2019-05-24 | 100% | 100% | **0%** |
| **Total** | **8,898** | — | ~99.97% | ~100% | **0%** |

- 19 additional leagues are registered in the manifest (NED, POR, BEL, SCO, TUR, AUT, SUI,
  DNK, NOR, SWE, POL, CZE, GRC, ROU, HRV, SRB, HUN, FIN, IRL) with **0 matches** — schema
  placeholders only `[OBSERVED]`.
- EPL duplicates rejected during normalization: 1,520 rows `[OBSERVED]` (manifest
  `duplicates` field).
- Outcome flags per match are precomputed (`btts`, `over15/25/35`, `under15/25/35`,
  `resultVerified=true`) `[OBSERVED]`.
- Odds block per match: opening (h1/d1/a1) + closing (ch1/cd1/ca1) 1X2, one `ahLine` with
  `ahHome/ahAway`, one `ouLine` (2.5) with over/under `[OBSERVED]`.

### 2.2 Historical odds depth (`market_odds.jsonl`) `[CALCULATED]`

- 77,471 odds rows: 53,376 `opening` + 24,095 `closing`; markets ML / AH / OU.
- Bookmaker sources: `betbrain`, `pinnacle` (sampled rows; full bookmaker census not run).
- **OU line distribution: 2.5 → 23,875 rows; every other OU line → 0.** Quarter OU lines
  (2.25 / 2.75 / 3.25) do **not exist** in historical gold.
- **AH line distribution (rows across observation × bookmaker):**

| Line | Rows | Line | Rows | Line | Rows |
|---|---|---|---|---|---|
| −3.75 | 2 | −1.5 | 1,116 | +0.25 | 2,451 |
| −3.5 | 6 | −1.25 | 828 | +0.5 | 1,180 |
| −3.25 | 12 | −1.0 | 2,485 | +0.75 | 978 |
| −3.0 | 58 | −0.75 | 1,810 | +1.0 | 1,175 |
| −2.75 | 86 | −0.5 | 2,312 | +1.25 | 358 |
| −2.5 | 260 | −0.25 | 4,335 | +1.5 | 506 |
| −2.25 | 210 | 0.0 | 2,243 | +1.75 | 108 |
| −2.0 | 660 | | | +2.0 | 188 |
| −1.75 | 450 | | | +2.25 | 18 |
| | | | | +2.5 | 24 |
| | | | | +3.0 | 4 |

- `[INFERENCE]` Quarter-line AH research is feasible in-band (−1.25 … +1.25 all ≥ ~350 rows);
  lines |line| ≥ 2.25 are too sparse for line-level evaluation.

### 2.3 Live odds layer (OddsPAPI) `[CLAIMED in EPIC 53 report]`

- 1,069 real snapshots from Jan 2026 onward, 38–60 snapshots per tracked fixture, opening /
  intermediate / pre-match retained separately; duplicates 0.
- Realized closing lines captured: **0 rows** ("NOT YET PROVEN / PENDING KICKOFF").
- EPIC 57 preflight status: **`ODDSPAPI_LIVE_AUTH_FAILED`** — live provenance gate FAILED as
  of `PRODUCTION_PROVENANCE_GATE_REPORT.md`.

### 2.4 Legacy warehouse (EPIC 54 tournament input)

- `data/historical/normalized_matches.jsonl`: 2,280 settled matches, VAR-era (≥ 2018-08-01),
  100% classified `[CLAIMED in EPIC 53 report; file observed]`.
- EPIC 54 folds: train 2020-21+2021-22 → validate 2022-23; … 1,140 OOS matches `[CLAIMED]`.

---

## 3. Per-Market Independent Evaluability Verdict

| Market | Probability evaluation (Brier/LogLoss/ECE) | EV / ROI historical | CLV historical | Verdict |
|---|---|---|---|---|
| **AH** | YES — quarter lines present, closing odds present | YES — settlement-aware EV possible (line-level caveat: |line|≥2.25 insufficient) | YES — closing column exists (date-granular) | **GO** |
| **OU** | YES — but **only line 2.5 exists**; quarter OU lines NOT AVAILABLE historically | YES — line 2.5 only | YES — line 2.5 only | **GO with restriction** — line-level evaluation restricted to 2.5; quarter OU = machinery only, no historical evidence |
| **BTTS** | YES — binary target derivable from results (100% coverage) | **NO — zero historical BTTS odds** | **NO** | **CONDITIONAL** — calibration-only research unless BTTS odds ingested (football-data.co.uk BTTS columns exist for recent seasons; ingestion not yet built) |

---

## 4. Prerequisite Gates

### EPIC 53 (fixture linkage / data integrity) — **PASS** `[CLAIMED, report PASSED]`
10/10 cross-provider linkage, synthetic isolation enforced (`is_synthetic=false` query
invariant, adversarial test PASS), bitwise point-in-time anti-leakage test PASS, VAR
classification 2,280/2,280. **Residual risk:** linkage acceptance test was 10 fixtures only;
`golden/europe` (football-data.co.uk) linkage is by canonical string ID, not the EPIC 53
resolver — acceptable for research, must be restated in EPIC 60 assumptions.

### EPIC 54 (per-market diagnostic / tournament) — **COMPLETE, QUALITY CAUTION** `[OBSERVED + INFERENCE]`
`MODEL_TOURNAMENT_REPORT.md` (2026-08-15): 2,280-match warehouse, 1,140 OOS matches, 3
chronological folds, champions: ML → Model 2 (market-augmented), AH → Model 2, OU → Model 1
(football-only), BTTS → Model 1. **Quality concerns for EPIC 60 baseline use:**

1. AH evaluated **only at line 0.0**; OU **only at 2.5** — no line-level diagnostics exist.
2. Model 2 uses de-vigged sharp odds **as input** — it cannot answer "does HandicapLab have
   predictive edge vs the market" (the circularity concern is real and already embodied in
   the current champion).
3. `[INFERENCE]` Internal consistency anomalies: ML and AH Brier identical to 4 decimals for
   Models 0/1 (0.6129 / 0.6421), AH Model 0 ROI +31.96% CI [+14.08%, +49.84%] with the same
   Brier as ML — suggests metric-reuse or scope bugs in the report. EPIC 54 numbers must NOT
   be reused as trusted baselines without re-audit of `modelTournamentEngine.ts`.

---

## 5. Gaps and Discrepancies EPIC 60 must address (design inputs)

1. **VOID settlement** absent from `settlement.ts` outcome type — Phase 1 target
   construction must add VOID (abandoned/postponed) per the proposed spec. `[OBSERVED]`
2. **CLV formula discrepancy**: governance §1.3 (`1/closing − 1/taken`) vs EPIC 54 shadow
   (`entry/closing − 1`). EPIC 60 must pick one and record it. `[OBSERVED]`
3. **Odds timestamps are date-granular** in historical gold → no intraday point-in-time
   cutoff, no odds-movement features, CLV is date-level. The spec's "odds snapshots that
   existed at the prediction timestamp" reduces to "opening vs closing observation on match
   date" for historical research. `[OBSERVED]`
4. **BTTS odds missing** → BTTS EV/ROI/CLV historically unevaluable. Options: (a) ingest
   football-data.co.uk BTTS columns (recent seasons only), (b) restrict BTTS-v1 acceptance to
   probability calibration gates. `[OBSERVED]`
5. **League skew**: only EPL has full 2015–2026 depth; 4 other leagues end 2019/2020 →
   per-league × per-line sample size will be thin outside EPL. `[OBSERVED]`
6. **EPIC 57 blocker**: OddsPAPI live auth FAILED → live closing-line capture and
   upcoming-fixture live EV are blocked; historical research is NOT blocked. `[CLAIMED]`
7. **prematch-v1 naming**: `model_registry.json` has no `prematch-v1` entry; the production
   engine is the `ProbabilityEngine` blend. The frozen-baseline comparator must be pinned to
   the exact registry/engine version before Phase 14 benchmarking. `[OBSERVED]`
8. **19 empty league placeholders** must be excluded from any per-league gate. `[OBSERVED]`

---

## 6. STOP / GO Decision

**GO for EPIC 60 Phase 1–12 (historical research)** with the restrictions in §3/§5:

- AH: full research GO (line-level gates restricted to well-populated lines).
- OU: GO restricted to line 2.5 for historical line-level claims; quarter OU machinery may be
  built but cannot be historically validated.
- BTTS: GO restricted to probability-calibration evidence (Brier/LogLoss/ECE) until BTTS odds
  are ingested; EV/CLV gates = INSUFFICIENT_DATA.
- Upcoming-fixture inference (Phase 12) and any live CLV claim: **BLOCKED** by EPIC 57
  (OddsPAPI auth) and by 0 realized closing lines.

**No training or model selection has been performed in this audit.** This document is
read-only evidence and makes no performance claims.

---

## 7. Source files used `[OBSERVED]`

- `data/golden/europe/{manifest.json,readiness.json,market_odds.jsonl,canonical_matches.jsonl}`
- `data/historical/*` (file inventory)
- `DATA_INTEGRITY_CHECKPOINT_REPORT.md` (EPIC 53), `MODEL_TOURNAMENT_REPORT.md` (EPIC 54),
  `PRODUCTION_PROVENANCE_GATE_REPORT.md` (EPIC 57 preflight), `LIVE_SHADOW_REPORT.md` (EPIC 56)
- `STATISTICAL_GOVERNANCE.md`, `model_registry.json`, `experiment_registry.json`, `feature_registry.json`
- `src/lib/engines/probability-engine/*`, `src/lib/settlement-core/devig.ts`,
  `src/historical/settlement/settlement.ts`, `src/historical/realOdds/{ingest,validate}.ts`,
  `src/lib/shadow/liveShadowEngine.ts`, `src/lib/tournament/modelTournamentEngine.ts`
- `supabase/migrations/00000000000047–51_*.sql`, `research/quant/epic_58a_audit/*`
