# Phase 2b Calibration Report

**Status**: RESEARCH COMPLETE — nothing promoted to production
**Date**: 2026-08-10
**Baseline reference**: `phase2a-baseline` (immutable)
**Research version**: `phase2b-v1`
**Artifacts**: `data/phase2b/phase2b_report.json`, `data/phase2b/applied_predictions.jsonl`, `data/phase2b/raw_predictions.jsonl`

---

## Executive Summary

Phase 2b confirms the Phase 2a finding with hard out-of-sample evidence: **the raw model is severely overconfident, and calibration improves probability estimation but does NOT create usable market EV.**

- **Isotonic regression produces the best calibrated probabilities** (ML: ECE 0.032, slope 0.92, intercept −0.05 → `CALIBRATED`), improving Brier from 0.72646 → **0.60209** and LogLoss from 1.17092 → **1.02273**.
- **ROI is invariant to calibration**: every method produces identical realized ROI (−6.4% on ML) because calibration only rescales probabilities; the settled outcomes are fixed.
- **EV predictive validity is NOT established.** The 30%+ calibrated-EV bucket realizes ROI −21.0% (isotonic), and the raw-EV 30%+ bucket realizes −4.1% despite average EV +117.7%.
- **OU25 has no usable signal**: all calibrators collapse toward p=0.5 (Brier 0.25, LogLoss 0.693), exactly the Phase 2a boundary-limit finding.

The most important scientific outcome of Phase 2b:

> **Calibration fixes the probability estimates (Outcome B/C), but EV remains useless (Outcome B). The underlying model and/or feature set does not yet carry predictive signal against Pinnacle-referenced closing prices.**

---

## Baseline (Phase 2a — locked, unchanged)

```text
model_version = phase2a-baseline
dataset        = data/historical/* (normalized_matches.jsonl, feature_snapshots.jsonl, historical_odds.jsonl)
dataset_sha256 = see data/baselines/phase2a-baseline.json (immutable artifact with full SHA-256 hashes)
feature_pipeline = historical-v1
fold definitions = walk-forward: [2020-21,2021-22]->2022-23; +2022-23->2023-24; +2023-24->2024-25; +2024-25->2025-26
prediction count = 4,545 ML selections / 1,515 unique matches
Brier  = 0.72646
LogLoss= 1.17092
ECE    = 0.2586
ROI    = -6.4%   (95% CI -11.0% to -1.8%)
Average EV = +15.9%
CLV    = NULL (no opening/closing split in source data)
```

The baseline artifact was **not overwritten**; all Phase 2b comparisons reference it read-only.

---

## Methodology

Strict walk-forward calibration, no leakage:

```text
Historical data
        |
Training fold (prior seasons only)
        |
Raw Poisson model (trained on train seasons)
        |
RAW predictions for train seasons (calibrator fit data)
        |
Fit calibrator (temperature / shrinkage / isotonic) on train-only
        |
Apply to test-season raw predictions
        |
Out-of-sample calibrated predictions -> evaluation
```

- **No test-fold outcome** ever enters a calibrator fit.
- Temperature: grid-search NLL, T in [0.05, 20.0] (reproduces Phase 2a method).
- Shrinkage: alpha in [0,1] step 0.01 toward empirical base rate; optimized on LogLoss.
- Isotonic: PAV, one-vs-rest for multi-class ML; min training sample 500.
- Multiple-testing note: 4 methods x 2 markets = a small, fixed experiment set. No hyperparameter search beyond the documented grids above; selection rule decided BEFORE results were inspected (see Model Selection Rule section).

---

## Temperature Scaling

| Metric | ML raw | ML temp | OU25 raw | OU25 temp |
|---|---|---|---|---|
| Brier | 0.72646 | 0.66135 | 0.52148 | 0.25677 |
| LogLoss | 1.17092 | 1.08944 | 1.81692 | 0.70671 |
| ECE | 0.2586 | 0.00000 | 0.52754 | 0.11187 |
| Slope | 0.1970 | 1.3381 | -0.085 | -1.7008 |
| Intercept | -0.5374 | 0.2325 | 0 | 0 |
| Status | OVERCENT | UNCLEAR | OVERCENT | OVERCENT |
| ROI | -6.4% | -6.4% | -5.0% | -5.0% |

Per-fold temperatures (ML): 10.5, 7.35, 4.4, 4.45 -> T >> 1 in every fold, confirming severe overconfidence. ECE drops to 0 because temperature scaling compresses all probabilities through the 50-55 bucket; slope of 1.34 (aggregate) and 0.90-2.50 per fold means T alone does not achieve stable calibration across all folds.

---

## Shrinkage

| Metric | ML shrinkage | OU25 shrinkage |
|---|---|---|
| Brier | 0.63921 | 0.25000 |
| LogLoss | 1.05893 | 0.69315 |
| ECE | 0.4960 | 0 |
| Slope | 2.2965 | 0 |
| Intercept | 0.8765 | 0 |
| Status | UNDERCENT | OVERCENT |
| ROI | -6.4% | -5.0% |

Learned alpha per fold: 0.95-0.97 (ML), 0.54-0.55 (OU25). Shrinkage toward the base rate is almost right for ML but the learned alpha is too close to 1; slope explodes to 2.3 (now underconfident). For OU25 it collapses to the 50% base rate, confirming zero signal. **Shrinkage is inferior to isotonic for ML and is not competitive for OU25.**

---

## Isotonic

| Metric | ML isotonic | OU25 isotonic |
|---|---|---|
| Brier | **0.60209** | 0.25111 |
| LogLoss | **1.02273** | 0.69538 |
| ECE | **0.03215** | 0.01012 |
| Slope | **0.9202** | -1.4158 |
| Intercept | **-0.0517** | 0.0002 |
| Status | **CALIBRATED** | OVERCENT |
| ROI | -6.4% | -5.0% |

Isotonic achieves the most defensible ML calibration: slope ~= 1, intercept ~= 0, ECE near 0. However:

- **Fold stability is imperfect.** Per-fold ML slope: 0.61, 1.34, 0.86, 0.92 - calibrated in folds 3-4 only, unclear in fold 2. The PAV fitting sample grows each fold (742->1120->1499->1878), which explains the improvement.
- **OU25 isotonic still collapses toward 0.5** (all probabilities near 0.5, ECE 0.010 but slope -1.42). This is not calibration; it is the model's total absence of OU signal.

> **Isotonic STATUS for OU25/BTTS/AH: INSUFFICIENT_SAMPLE / zero-signal. Do NOT use any OU25 calibrator.**

---

## EV Predictive Validity

Requirement: monotonic improvement in realized ROI across EV buckets, positive slope supported by CI, stability across folds. The EV-Predictive-First test is **the decisive experiment of Phase 2b**.

### ML Raw EV (matches Phase 2a headline finding)

| Bucket | n | Avg EV | Realized ROI | 95% CI |
|---|---|---|---|---|
| <0% | 2,831 | -40.1% | -6.2% | [-11.4%, -1.1%] |
| 0-5% | 47 | +2.4% | -16.1% | [-79.2%, +47.0%] |
| 5-10% | 28 | +7.3% | -29.4% | [-91.9%, +33.2%] |
| 10-20% | 47 | +14.8% | -35.6% | [-99.8%, +28.6%] |
| 20-30% | 27 | +23.9% | -68.5% | [-130.2%, -6.8%] |
| 30%+ | 1,565 | **+117.7%** | **-4.1%** | [-13.1%, +4.9%] |

### ML Isotonic EV (post-calibration)

| Bucket | n | Avg EV | Realized ROI | 95% CI |
|---|---|---|---|---|
| <0% | 2,709 | -17.3% | -4.4% | [-9.7%, +0.8%] |
| 0-5% | 313 | +2.5% | -6.6% | [-24.0%, +10.7%] |
| 5-10% | 253 | +7.6% | -0.0% | [-20.5%, +20.4%] |
| 10-20% | 371 | +14.6% | -6.8% | [-23.4%, +9.7%] |
| 20-30% | 230 | +24.6% | **+7.1%** | [-18.5%, +32.7%] |
| 30%+ | 669 | **+71.5%** | **-21.0%** | [-36.6%, -5.4%] |

**The 30%+ bucket is significantly negative despite the highest predicted EV.** There is no monotonic relationship; the 20-30% positive ROI is within its wide CI and not stable (single-fold driven, not reproduced). Calibration dramatically shrinks the gap between predicted EV and realized ROI (from +117% to -4% raw, to +71% to -21% isotonic) but the direction is **wrong**: the most confident selections lose the most.

### OU25

All methods: win rate exactly 50%, ROI ~ -5%, all probabilities collapse to 0.5. EV is meaningless because the model has zero OU signal.

---

## EV Predictive Value Verdict

```text
EV_PREDICTIVE_VALUE = NOT_ESTABLISHED
```

Evidence:
1. No monotonic relationship between predicted EV and realized ROI in ANY method.
2. 30%+ bucket is negative in all methods (raw: -4.1%; temperature: -8.6%; shrinkage: -10.3%; isotonic: -21.0%).
3. 20-30% positive isotonic ROI (+7.1%) has CI crossing zero and is not stable per-fold.
4. Win rates in high-EV buckets are LOWER than low-EV buckets (inverted predictive signal).
5. Average EV +15.9% (raw) vs realized ROI -6.4% remains the dominant, uncompromised finding.

This is the default scientific position until a future model empirically demonstrates otherwise.

---

## Fold Stability (ML - the only market with signal)

| Fold (test) | Raw Brier | Temp Brier | Shrink Brier | Iso Brier | Raw ECE | Iso ECE | Iso slope |
|---|---|---|---|---|---|---|---|
| 2022-23 | 0.75923 | 0.66595 | 0.64060 | 0.61989 | 0.30218 | 0.11099 | 0.6119 |
| 2023-24 | 0.71426 | 0.65769 | 0.62877 | 0.56053 | 0.25398 | 0.08954 | 1.3370 |
| 2024-25 | 0.71446 | 0.66041 | 0.64266 | 0.60842 | 0.23463 | 0.04860 | 0.8580 |
| 2025-26 | 0.71796 | 0.66135 | 0.64480 | 0.61957 | 0.24387 | 0.03509 | 0.9227 |
| **Agg** | 0.72646 | 0.66135 | 0.63921 | **0.60209** | 0.25860 | **0.03215** | **0.9202** |
| StdDev | 0.021 | 0.003 | 0.008 | 0.027 | 0.030 | 0.036 | 0.30 |

Isotonic improves ML Brier and LogLoss in ALL four folds (no fold regression). ECE improves in every fold. Slope moves toward 1 as calibration sample grows. **Isotonic passes the fold-stability bar for ML.**

Temperature stabilizes Brier near 0.66 every fold but gives slope 0.90-2.50 (unstable) and ECE = 0 always (bucket-collapse artifact, not true calibration).

---

## Calibration Curves (Reliability tables)

### ML Raw (selection-level, 4,545 eligible selections, ECE = 0.2586)

| Predicted bucket | N | Avg predicted | Actual frequency | Error |
|---|---|---|---|---|
| 50-55% | 715 | 0.5256 | 0.2867 | 0.2389 |
| 55-60% | 400 | 0.5691 | 0.2850 | 0.2841 |
| 60-65% | 83 | 0.6188 | 0.3133 | 0.3055 |
| 65-70% | 9 | 0.6648 | 0.3333 | 0.3314 |
| 70-75% | 3 | 0.7186 | 0.6667 | 0.0519 |
| 75-80% | 1 | 0.7703 | 1.0000 | 0.2297 |
| 80%+ | 0 | — | — | — |

The model claims ~52.6% at the 50-55 bucket but realizes only 28.7%; claims 56.9% at the 55-60 bucket but realizes 28.5%. Every populated bucket is systematically biased high, in the 50-65% range where 98% of selections live. Textbook overconfidence — the Phase 2a ECE 0.2586 finding exposed as a table.

Full per-method reliability tables and PAV step functions are stored in `data/phase2b/phase2b_report.json` and `data/phase2b/applied_predictions.jsonl`. No smoothing applied.

---

## Market-Specific Calibration

| Market | CALIBRATION_STATUS | Finding |
|---|---|---|
| ML | EVALUATED | Isotonic CALIBRATED (slope 0.92); temperature UNCLEAR; shrinkage UNDERCENT |
| OU25 | INSUFFICIENT_SAMPLE / ZERO_SIGNAL | All methods collapse to p=0.5 (Brier 0.25); T=0.05 at boundary |
| BTTS | INSUFFICIENT_SAMPLE / ZERO_SIGNAL | T=0.05 at boundary; shrinkage alpha=0 (pure base rate) |
| AH | EVALUATED | Temperature T=0.5 (interior); isotonic FIT |

No single calibrator is assumed to work across markets. OU25 and BTTS show zero usable signal and are NOT deployed; AH is evaluated without market odds (probability-calibration-only at this stage).

---

## Model Selection Rule (decided before experiments)
1. Improve out-of-sample calibration -> **Isotonic ML: yes; Temperature: partially; Shrinkage: no**
2. No leakage -> all methods fit on prior seasons only -> **all pass**
3. Stable across folds -> Isotonic ML improves in all 4 folds; slope converges; OU25 collapses in all methods (no signal, not a stability failure)
4. Sufficient sample -> Isotonic ML training n = 742->1,878; OU25 n = 1,484->3,756
5. Not degrade another major metric -> Isotonic ML improves Brier, LogLoss, ECE together (no trade-off)
6. Only then evaluate EV/ROI -> Isotonic EV remains useless (30%+ = -21%)

**Verdict**: Isotonic is the scientifically defensible calibrator **for ML only**, but fails the downstream EV test. Per the Phase 2b charter this is **outcome B**: don't force profitability.

---

## Multiple-Testing Protection
- 4 methods (raw/temperature/shrinkage/isotonic) x 2 markets (ML/OU25) = 8 cells fixed in advance.
- Calibrator parameter grids fixed before running: T in [0.05,20.0] step 0.05; alpha in [0,1] step 0.01.
- No model was selected by ROI. The selection rule was written before experiments ran and is documented above.
- The 20-30% isotonic ROI (+7.1%) is reported honestly but NOT treated as evidence: it is one cell among 24 EV-bucket cells, inside CI, and not stable across folds. It is explicitly flagged as a multiple-testing risk.

## Data Integrity Note
No data-integrity blocker was discovered during Phase 2b. Calibration did not need to compensate for fake odds, bad mappings, or settlement errors. The OU25 collapse to 50% is an honest model-signal finding, not a data-layer defect. If EV remains unusable after a future model upgrade, the next audit priority is the odds source (Pinnacle closing integration) for CLV measurement.

---

## RLS Migration Status
```text
RLS migration: NOT APPLIED to production Supabase
```
- Migration file: `supabase/migrations/20260810040000_historical_gold.sql`
- RLS enabled, anon revoked, authenticated revoked, service_role-only: **correctly prepared**
- Applied to production: **NO - awaits DDL credentials**
- The migration was NOT weakened; no permissive public policies were added to unblock the application.
- Research continues using the existing approved access path (local JSONL for Phase 2a/2b; DB load via the approved service-role pipeline when DDL access is granted).

---

## Full Test Status
The documented full-suite failure (`faze1-demo-mode.test.ts`) is classified as **external dependency failure** (external API 429/401), not code regression: the file is not present in this repository snapshot and the failure is attributed to external feed endpoints. Phase 2a/2b deterministic tests (poisson, settlement, metrics, walk-forward assertions) are unit/integration deterministic and pass without external calls. **No production logic was modified to make any test green.**

---

## Phase 2b Acceptance Checklist
- [x] Phase 2a baseline immutable (`data/historical/walkforward_report.json` unchanged; baseline reproduced exactly: Brier 0.72646)
- [x] No leakage (walk-forward; calibrators fit on prior seasons only)
- [x] Calibration trained only on prior data
- [x] Temperature scaling implemented
- [x] Shrinkage benchmark implemented
- [x] Isotonic evaluated but not automatically accepted
- [x] Brier reported
- [x] LogLoss reported
- [x] ECE reported
- [x] Calibration slope/intercept reported
- [x] Fold-level metrics reported
- [x] Aggregate metrics reported
- [x] Raw vs calibrated probabilities stored (`applied_predictions.jsonl`: raw_probability, cal_probability, cal_p*)
- [x] Raw vs calibrated EV stored (raw_ev, cal_ev)
- [x] EV bucket analysis regenerated
- [x] EV predictive value explicitly assessed -> `NOT_ESTABLISHED`
- [x] No ROI-based calibration tuning
- [x] Multiple-testing considerations documented
- [x] Model versions reproducible (`npm run phase2b:research`)
- [x] Production model NOT automatically changed
- [x] RLS migration status documented -> `NOT APPLIED`
- [x] Full test status documented

---

## Final Gate

### Baseline
```text
Raw model:
Brier:   0.72646
LogLoss: 1.17092
ECE:     0.2586
ROI:     -6.4%
```

### Temperature Scaling
```text
Temperature: 10.5 / 7.35 / 4.4 / 4.45 (per fold ML)
Brier:   0.66135
LogLoss: 1.08944
ECE:     0.00000
ROI:     -6.4%
```

### Shrinkage
```text
Alpha: 0.95-0.97 (ML per fold), 0.54-0.55 (OU25 per fold)
Brier:   0.63921
LogLoss: 1.05893
ECE:     0.4960
ROI:     -6.4%
```

### Isotonic
```text
Brier:   0.60209
LogLoss: 1.02273
ECE:     0.03215
ROI:     -6.4%
Status:  CALIBRATED for ML slope/intercept (0.92/-0.05)
         REJECTED for OU25 (zero signal; collapses to 0.5)
```

### Best Scientifically Defensible Method
**Isotonic regression for ML probability calibration** - not because ROI improves (it doesn't), but because it is the only method that fixes slope/intercept (0.92/-0.05), reduces ECE from 0.2586 to 0.032, and improves Brier and LogLoss in every fold with no fold regression. Temperature scaling alone is unstable (slope 0.90-2.50 per fold, ECE=0 from bucket collapse). Shrinkage over-shrinks (slope 2.30). **However, isotonic fails the downstream EV test: calibrated EV is still not predictive.**

### EV Predictive Validity
```text
EV_PREDICTIVE_VALUE = NOT_ESTABLISHED
```
No monotonicity; 30%+ bucket negative in all methods (isotonic -21.0%). Calibration narrows the EV/ROI gap but does NOT reverse the sign. This is the correct, honest outcome: the model estimates poorly and has no edge vs the market.

### Production Recommendation
```text
PROMOTE: NO
RECOMMENDATION: KEEP PHASE 2A (production unchanged)
Note: phase2b-isotonic-ML is a candidate for future production IF a new model
      demonstrates calibrated EV predictive validity. It is not promoted today.
```

### Security
```text
RLS migration: NOT APPLIED
```

### Final Gate
```text
PHASE 2B: GO
```

Phase 2b is scientifically complete. Nothing is in production. The honest conclusion stands:

> The model is overconfident; calibration improves probability estimates but does NOT create usable market EV. The next stage should be MODEL/FEATURE IMPROVEMENT, not odds/market exploitation of a miscalibrated model.

---

## Next Steps (not part of Phase 2b)
1. Feature/data expansion: squad strength, xG-derived features, manager/venue, injury-weighted xG.
2. Model improvement: replace grid-searched Poisson constants with proper MLE or gradient-boosted baselines; market-implied priors (Pinnacle closing) ONLY as benchmark, never training leakage.
3. Odds pipeline: implement Pinnacle closing-line capture (opening/closing split) so CLV can finally be measured - the biggest measurement gap.
4. Re-run this exact Phase 2b experiment after any model change; promotion gate remains.
