# Sprint 1.7 Post-Calibration Validation Report

**Status:** NOT READY

## Success Criteria Evaluation
- [x] **SH Under ECE < 10%** (0.57%)
- [ ] **SH Under bias < -0.5** (A=1.09, B=-0.07)
- [ ] **SH Under ROI > +3%** after vig (0.00%)
- [x] **FT O/U ECE < 8%** (1.25%)
- [x] **AH ECE < 10%** (3.33%)
- [ ] **Ablation helps** (0 features kept)

## Train vs Validation Metrics

| Metric | Training (70%) | Validation (30%) |
|--------|----------------|------------------|
| **SH Under ROI** | 0.00% | 0.00% |
| **Brier Score (SH Under)** | 0.1338 | 0.1405 |

## Red Flags
- MARKET_BEATEN
- SH_UNDER_BIAS_FAIL
- SH_UNDER_ROI_FAIL
- ABLATION_FAIL
