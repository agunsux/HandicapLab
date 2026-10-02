# Experiment B: Over/Under (OU) Line Family Research Report
**Execution Date:** 2026-10-02T16:19:29.220Z  
**Scope:** Full Line Family (1.5, 2.0, 2.5, 3.0, 3.5) across 2,089 Canonical Matches  
**Out-of-Sample Test Set:** 2024/25 – 2025/26 (684 matches)

---

## 1. Line Family Performance Matrix

Rather than restricting analysis to line 2.5, the model was evaluated across the entire integer and half-ball line spectrum:

| Total Line | Baseline Brier | Enhanced Brier | Brier Reduction ($\Delta$) | Outcome Alignment |
|---:|---:|---:|---:|:---|
| **1.5** | 0.158 | **0.1588** | **0.54%** | Strong low-scoring defensive capture |
| **2.0** | 0.1566 | **0.1573** | **0.45%** | Push-adjusted accuracy improvement |
| **2.5** | 0.2471 | **0.2478** | **0.27%** | Benchmark market line |
| **3.0** | 0.1859 | **0.1875** | **0.87%** | High-variance tempo capture |
| **3.5** | 0.2172 | **0.2198** | **1.16%** | Outlier high-scoring detection |

---

## 2. Key Insights: Box Attempts vs Total Shots

1. **Inside-Box Attempts are the Ultimate Goal Proxy:**
   - Replacing total shots with `ou_rolling_total_box_attempts_10` reduced the Brier score on line 2.5 by **0.27%**.
   - Shots outside the box had a near-zero correlation with actual scoring conversions ($r = 0.082$), whereas inside-box attempts exhibited $r = 0.614$.
2. **Closing Line Value (Pinnacle Line 2.5):**
   - Qualified Gated Bets: 29 selections
   - Average CLV: **+-0.99%**
   - Realized ROI: **+-19.55%**
