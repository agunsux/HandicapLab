=== EPL AH RESEARCH FORENSIC REPORT ===

Seasons:
2024/25 (Discovery)
2025/26 (Out-of-Sample Holdout)

Expected fixtures:
760

Verified result fixtures:
760 (100%)

Verified Pinnacle AH fixtures:
759 (99.9%)

AH 0:
89 (11.71% of fixtures)

Positive AH:
231 (30.39% of fixtures)

Negative AH:
439 (57.76% of fixtures)

Bookmaker provenance:
Pinnacle (Opening PAHH/PAHA & Closing PCAHH/PCAHA) via European Gold Manifest

Historical odds provenance:
Football-Data.co.uk 2024-2025.csv & 2025-2026.csv

CLV:
Calculated strictly when Opening & Closing exist for the exact same Pinnacle AH line

Look-ahead:
PASS

Dummy data:
PASS

Settlement:
PASS

Model Quality:
Dixon-Coles Bivariate Poisson (Strict Temporal Holdout)
- Model Brier Score: 0.6088 (vs Baseline Uniform: 0.6667, Baseline Home-Bias: 0.612)
- Model Log Loss: 1.014
- Brier Skill Score: +0.52%

---

### TEMPORAL HOLDOUT & OUT-OF-SAMPLE EDGE VALIDATION

| Candidate Rule | 2024/25 (Disc N) | 2024/25 (Disc ROI) | 2025/26 (OOS N) | 2025/26 (OOS ROI) | 2025/26 (OOS CLV) | Comb ROI | OOS Status | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Away +0.50 Underdog (vs Home -0.50) | 32 | +15% | 49 | +7.76% | +1.48% | +10.62% | **SURVIVED_OOS** | PROMISING |
| Home +0.25 Underdog | 35 | +0.8% | 36 | +9.31% | +0.4% | +5.11% | **SURVIVED_OOS** | PROMISING |
| Away +1.50 Underdog (vs Home -1.50) | 27 | +21.52% | 8 | -5.88% | +1.36% | +15.26% | **FAILED_OOS_DATA_MINED** | INCONCLUSIVE |
| Away +1.00 Underdog (vs Home -1.00) | 31 | +19.45% | 26 | -6.58% | -1.11% | +7.58% | **FAILED_OOS_DATA_MINED** | INCONCLUSIVE |
| Away +1.25 Underdog (vs Home -1.25) | 20 | +22.1% | 29 | -5.47% | -2.16% | +5.78% | **FAILED_OOS_DATA_MINED** | INCONCLUSIVE |
| Home +0.50 Underdog | 25 | -28.48% | 31 | +30.55% | -0.09% | +4.2% | **UNSTABLE_REGIME** | INCONCLUSIVE |
| Home AH 0.00 (Draw No Bet) | 43 | -14% | 46 | +4.63% | -1.37% | -4.37% | **LOSS** | LOSS |

---

### RESEARCH VERDICT & MULTIPLE TESTING AUDIT

- **Primary Question Verdict**: **LOSS**
- **Explanation**: Unfiltered flat backing of HOME AH +0 is LOSS-MAKING (-4.37% ROI, -1.22% CLV). In temporal holdout testing (2024/25 discovery -> 2025/26 validation), naive top-ranked lines like Away +1.50 and Away +1.00 failed out-of-sample (data-mining decay). Only Away +0.50 and Home +0.25 survived holdout, but are classified as PROMISING BUT UNPROVEN pending larger sample sizes.
- **Multiple Testing Alert**: Scanning multiple lines and EV thresholds inflates false discovery rates. Out of 7 candidate rules discovered in 2024/25, 4 failed out-of-sample in 2025/26.
