# HandicapLab — Scientific Method

**Type:** Research Methodology Standards  
**Status:** Active — Ratified alongside Architecture Constitution  
**Last Updated:** 2026-07-11  

---

## Purpose

This document defines the **scientific method** that governs all research, model development, and validation at HandicapLab. Unlike `ARCHITECTURE_INVARIANTS.md` (which governs code structure) and `ENGINEERING_PRINCIPLES.md` (which governs code quality), this document governs **how we know what we know**.

HandicapLab is not merely a prediction platform. It is a **quantitative research platform**. Every claim about model performance must be backed by evidence that meets the standards defined here.

---

## The Research Lifecycle

```
Hypothesis
    ↓
Experiment Design
    ↓
Data Collection / Dataset Selection
    ↓
Walk-Forward Validation
    ↓
Bootstrap Resampling
    ↓
Calibration Analysis
    ↓
Evidence Review
    ↓
Conclusion
    ↓
Peer Review (ADR)
    ↓
Deploy / Promote
    ↓
Monitor
    ↓
Retire
```

Each stage has specific requirements.

---

## Stage 1 — Hypothesis

Every research experiment must start with a falsifiable hypothesis.

**Good hypothesis examples:**
- "Replacing Poisson with Dixon-Coles improves ECE by at least 0.01 in EPL"
- "Adding rest-day features increases ROI by at least 2% in Bundesliga"
- "Market-agnostic calibration outperforms market-specific calibration in AH"

**Bad hypothesis examples:**
- "Make model better" (not falsifiable)
- "Improve predictions" (not measurable)
- "Test new features" (not specific)

**Rule:** A hypothesis is only valid if it can be proven false by experiment results.

---

## Stage 2 — Experiment Design

Every experiment must specify:

| Parameter | Required | Description |
|---|---|---|
| Dataset version | ✅ | Canonical dataset used |
| Feature set version | ✅ | Which features are enabled |
| Model version | ✅ | Which model is being tested |
| Market types | ✅ | ML, AH, OU, BTTS |
| League filter | ✅ | Which leagues are included |
| Season filter | ✅ | Which seasons are included |
| Walk-forward method | ✅ | Rolling window, expanding, chronological split |
| Bootstrap samples | ✅ | Number of resamples (minimum 1,000) |
| Seed | ✅ | Random seed for reproducibility |
| Success criteria | ✅ | What metrics must improve and by how much |

**Rule:** An experiment with unspecified parameters is not reproducible and will be rejected.

---

## Stage 3 — Data Integrity

Before any experiment runs, data quality must be verified:

- No future data leakage (kickoff timestamps validated)
- No duplicate fixtures
- No missing critical fields (home team, away team, kickoff, odds, result)
- Team identities resolved to canonical IDs (coverage ≥ 99%)
- League identities resolved to canonical IDs (coverage = 100%)
- Odds are valid (decimal, positive, within reasonable range)
- Results are valid (non-negative goals)

**Rule:** Experiments on datasets failing data quality checks are invalid and will not be accepted.

---

## Stage 4 — Walk-Forward Validation

Single-period validation is **never** sufficient. All experiments must use time-aware validation:

| Method | When to Use | Minimum |
|---|---|---|
| Chronological split | First experiment on a dataset | 70/30 train/test |
| Rolling window | Ongoing model evaluation | Window ≥ 200 matches, step ≥ 50 |
| Expanding window | Long-term trend analysis | Initial window ≥ 200 matches |
| League-based | Cross-league comparison | Per-league minimum 100 matches |

**Rule:** A model validated only on a single time period has **no scientific value**. Walk-forward is mandatory.

---

## Stage 5 — Bootstrap Resampling

Point estimates of metrics are insufficient. Every metric must include uncertainty quantification:

| Metric | Bootstrap Required | Minimum Samples |
|---|---|---|
| ROI | ✅ | 1,000 |
| CLV | ✅ | 1,000 |
| Brier Score | ✅ | 1,000 |
| Calibration ECE | ✅ | 1,000 |
| Win Rate | ✅ | 1,000 |

Bootstrap results must include:
- Mean
- Standard error
- 95% confidence interval
- 99% confidence interval

**Rule:** Metrics without confidence intervals are considered preliminary and cannot be used for promotion decisions.

---

## Stage 6 — Calibration Analysis

Every model's calibration must be evaluated:

| Metric | Threshold | Meaning |
|---|---|---|
| ECE | < 0.03 | Well-calibrated |
| ECE | 0.03–0.05 | Acceptable |
| ECE | > 0.05 | Poor — do not deploy |
| MCE | < 0.10 | No extreme miscalibration |
| Sharpness | > 0 | Model is confident |

Calibration must be evaluated per:
- Market type (ML, AH, OU, BTTS)
- League (EPL, La Liga, etc.)
- Confidence bin (0–10%, 10–20%, ..., 90–100%)

**Rule:** A model with ECE > 0.05 in any primary market must not be promoted to champion.

---

## Stage 7 — Evidence Review

Before any conclusion is drawn, the following evidence mosaic must be reviewed:

| Evidence | Required | What It Shows |
|---|---|---|
| ROI with 95% CI | ✅ | Profitability |
| CLV with 95% CI | ✅ | Market edge |
| Brier Score | ✅ | Prediction accuracy |
| ECE + MCE | ✅ | Calibration quality |
| Walk-forward stability | ✅ | Temporal robustness |
| Bootstrap distribution | ✅ | Statistical significance |
| League consistency | ✅ | Cross-league validity |
| Market consistency | ✅ | Cross-market validity |
| Season consistency | ✅ | Temporal generalizability |

**Rule:** A conclusion based on fewer than 5 of these evidence types is considered **weak**.

---

## Stage 8 — Conclusion

Conclusions must be one of:

| Conclusion | Criteria |
|---|---|
| **Strong accept** | All evidence types positive, CI excludes zero, walk-forward stable |
| **Weak accept** | Most evidence types positive, CI includes zero |
| **Inconclusive** | Mixed evidence, insufficient sample size |
| **Weak reject** | Most evidence types negative, but CI includes zero |
| **Strong reject** | All evidence types negative, CI excludes zero |

**Rule:** A "Strong accept" conclusion requires at least 500 settled predictions across minimum 2 leagues.

---

## Stage 9 — Deploy / Promote

Model promotion follows ADR-034 (Evidence Over Outcome):

A model may only be promoted from challenger to champion when:
1. ROI increase is statistically significant (95% CI does not include zero)
2. CLV does not decrease significantly
3. Calibration ECE does not exceed 0.05
4. Walk-forward validation shows consistent improvement across windows
5. Bootstrap confidence intervals support the improvement
6. Explainability quality does not decrease
7. At least 2 leagues show consistent improvement

**Rule:** Models are promoted based on **quality of evidence**, not magnitude of a single metric.

---

## Stage 10 — Monitor

After deployment, every model is continuously monitored:

| Monitor | Frequency | Alert Threshold |
|---|---|---|
| ROI | Daily | Drop > 5% in 7-day rolling |
| CLV | Daily | Drop > 0.02 in 7-day rolling |
| Calibration ECE | Weekly | Exceeds 0.05 |
| Prediction distribution | Weekly | PSI > 0.1 |
| Feature distribution | Weekly | PSI > 0.1 per feature |
| Data quality | Daily | Any critical failure |

**Rule:** Any alert triggers an automatic experiment to diagnose and address the regression.

---

## Stage 11 — Retire

A model is retired when:
1. A superior model has been promoted (champion replaced)
2. Monitoring alerts indicate persistent degradation beyond recovery
3. The feature set it depends on has been deprecated
4. The market it serves has been deprecated

Retirement must be documented in the Model Registry with reason and supporting evidence.

---

## Anti-Patterns

The following are explicitly forbidden:

| Anti-Pattern | Why |
|---|---|
| Cherry-picking the best time period | Hides temporal instability |
| Ignoring confidence intervals | Overestimates precision |
| Comparing models on different datasets | Invalid comparison |
| Using future data in features | Data leakage — invalidates results |
| Reporting only positive metrics | Survivorship bias |
| Stopping after one good result | Ignores regression risk |
| Changing hypothesis after seeing results | HARKing (Hypothesizing After Results are Known) |

---

## Sample Size Requirements

| Claim Type | Minimum Sample |
|---|---|
| Preliminary (exploratory) | 100 predictions |
| Acceptable (internal use) | 500 predictions across 2 leagues |
| Strong (promotion decision) | 1,000 predictions across 3 leagues |
| Published (external claim) | 5,000 predictions across 5 leagues |

**Rule:** Smaller sample sizes may only produce "preliminary" or "inconclusive" conclusions.

---

## Compliance Checklist

Every experiment report must pass this checklist:

| # | Requirement | Check |
|---|---|---|
| 1 | Falsifiable hypothesis stated | ☐ |
| 2 | All experiment parameters recorded | ☐ |
| 3 | Data quality verified | ☐ |
| 4 | Walk-forward validation performed | ☐ |
| 5 | Bootstrap resampling (≥ 1,000) | ☐ |
| 6 | Calibration ECE reported | ☐ |
| 7 | Evidence mosaic (≥ 5 types) | ☐ |
| 8 | Sample size meets minimum for claim | ☐ |
| 9 | No anti-patterns present | ☐ |
| 10 | Conclusion strength stated | ☐ |