# EPIC 56 — MULTIPLE TESTING & DISCOVERY CONTROL

**Execution Timestamp:** 2026-08-29T11:21:09.005Z  

---

## 1. Hypotheses Tested & Correction

- **Total Pre-Specified Hypotheses**: 7
- **Bonferroni Adjusted Alpha**: $\alpha = 0.05 / 7 = 0.0071$
- **False Discovery Rate (FDR)**: Benjamini-Hochberg procedure applied.

---

## 2. Hypothesis Testing Ledger

| Line | Discovery EV | Discovery ROI | Discovery Sample | p-Value | Bonferroni Sig? | FDR Sig? | Confirmation Sample | Confirmed? |
|---|---|---|---|---|---|---|---|---|
| **-0.75** | -10.12% | -5.56% | 1243 | 0.999 | NO | NO | 618 | `FAIL` |
| **-0.50** | -9.64% | -6.84% | 1358 | 0.999 | NO | NO | 738 | `FAIL` |
| **-0.25** | -10.60% | -0.75% | 3575 | 0.999 | NO | NO | 936 | `FAIL` |
| **+0.00** | -2.17% | +0.96% | 1862 | 0.999 | NO | NO | 886 | `FAIL` |
| **+0.25** | +5.05% | -3.69% | 3575 | 0.001 | YES | YES | 936 | `FAIL` |
| **+0.50** | +3.89% | +5.00% | 1358 | 0.001 | YES | YES | 738 | `PASS` |
| **+0.75** | +4.38% | -7.76% | 1243 | 0.001 | YES | YES | 618 | `FAIL` |
