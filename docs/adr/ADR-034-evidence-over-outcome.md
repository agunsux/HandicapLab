# ADR-034 — Evidence Over Outcome

**Date:** 2026-07-11  
**Status:** Ratified  

---

## Context

Model promotion decisions are often driven by a single metric: ROI. A model that shows higher ROI in a backtest is promoted, while a model with lower ROI is demoted. This creates several problems:

1. **ROI is noisy** — Small sample sizes produce unreliable ROI estimates
2. **ROI is temporal** — A model that outperforms in one period may underperform in the next
3. **ROI hides degradation** — A model may show higher ROI but worse calibration, higher variance, or lower CLV
4. **ROI incentivizes overfitting** — Models can be tuned to maximize backtest ROI at the expense of generalizability
5. **ROI ignores statistical significance** — A 2% ROI improvement may not be statistically significant

HandicapLab's Model Registry has a promotion system that requires a decision rule. Without explicit criteria, promotion decisions are subjective and non-reproducible.

---

## Decision

Model promotion will follow the **Evidence Over Outcome** principle:

> A model is not considered better simply because it has higher ROI.

A model may only be promoted from challenger to champion when ALL of the following criteria are met:

### Mandatory Criteria

| # | Criterion | Metric | Threshold |
|---|---|---|---|
| 1 | ROI improvement is statistically significant | 95% CI does not include zero | CI lower bound > 0 |
| 2 | CLV does not decrease significantly | 95% CI of delta does not cross zero | CI lower bound > -0.01 |
| 3 | Calibration remains acceptable | ECE | < 0.05 |
| 4 | Walk-forward validation consistent | % of windows where model outperforms | ≥ 60% |
| 5 | Bootstrap confidence intervals support improvement | 95% CI of ROI delta | Entirely positive |
| 6 | At least 2 leagues show consistent improvement | Per-league ROI | Positive in ≥ 2 leagues |
| 7 | Minimum sample size | Total predictions | ≥ 500 across ≥ 2 leagues |
| 8 | No degradation in explainability | Feature contribution variance | Within 20% of champion |
| 9 | No degradation in prediction stability | Prediction variance | Not increased significantly |
| 10 | Champion change does not break existing consumers | Public interface compatibility | 100% backward compatible |

### Strong Evidence Criteria (Recommended for Publication)

| # | Criterion | Threshold |
|---|---|---|
| 11 | Minimum sample size for publication | ≥ 1,000 predictions across ≥ 3 leagues |
| 12 | Walk-forward outperformance | ≥ 70% of windows |
| 13 | Bootstrap significance | 99% CI entirely positive |
| 14 | Cross-market consistency | Positive ROI in ≥ 3 of 4 markets (ML, AH, OU, BTTS) |

---

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| **ROI-only promotion** | Single metric is unreliable; incentivizes overfitting |
| **Manual review without criteria** | Non-reproducible; subjective |
| **Equal weighting of all metrics** | Some metrics are more important than others |
| **No promotion system** | Static model portfolio misses improvement opportunities |

---

## Consequences

### Positive

- Promotions are based on **evidence quality**, not metric magnitude
- Statistical rigor prevents overfitting to noise
- Multiple dimensions (ROI, CLV, calibration, walk-forward) provide a complete picture
- Reproducible promotion criteria enable automation
- Users can trust that promoted models have been thoroughly evaluated

### Negative

- Promotion requires more data (minimum 500 predictions)
- New models take longer to reach champion status
- Implementation requires integration between ModelRegistry and Validation modules
- Small-sample models (< 500 predictions) cannot be promoted regardless of performance

### Neutral

- Existing champion remains until sufficient evidence accumulates
- Rapid iteration on new models is still possible at the challenger level
- Shadow mode deployment is not affected by this ADR

---

## Compliance

The promotion criteria must be enforced by the Model Registry's `promote()` method. Before promoting a model to champion, the registry must verify:

1. The model has validation metrics stored (via `setValidationMetrics()`)
2. The metrics meet the evidence thresholds defined above
3. Walk-forward results exist (via `WalkForwardValidator`)
4. Bootstrap results exist (via `BootstrapValidator`)
5. League comparison exists (via `LeagueComparison`)
6. Sample size meets minimum requirements

If any criterion is not met, the promotion must be rejected with a clear error message identifying the failed criterion.

---

## Migration

Existing champions at the time of ratification are grandfathered. No retroactive promotion review is required. All new promotions must pass the criteria.

A one-time baseline audit should be performed on the current champion to document its evidence profile for future comparison.