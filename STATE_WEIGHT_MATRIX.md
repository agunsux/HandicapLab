# State Weight Matrix & Fallback Report

## Platt Calibration
| Market | A (Slope) | B (Bias) |
|--------|-----------|----------|
| SH_UNDER | 1.0909 | -0.0691 |
| FT_OU | 0.9911 | -0.0847 |
| AH_HOME | 1.1572 | -0.0109 |
| ML_HOME | 0.4687 | -0.3294 |

## State Weights (Level 2)
| State | Samples | Fallback | Bias | Tempo Weight | Pressure Weight | DefShape Weight | Cond. ECE (Val) |
|-------|---------|----------|------|--------------|-----------------|-----------------|-----------------|
| 0-0 | 1613 | NO | -1.0419 | 0.0585 | -0.4678 | 0.1371 | 3.63% |
| 1-0 | 1256 | NO | -1.1574 | 0.0648 | -0.5072 | 0.0855 | 0.39% |
| 0-1 | 954 | NO | -1.1532 | -0.0031 | -0.5082 | 0.0917 | N/A |
| 1-1 | 763 | NO | -1.2015 | 0.0194 | -0.5638 | 0.1588 | 2.11% |
| 2+ | 2414 | NO | -1.2841 | 0.1081 | -0.6050 | 0.1454 | 0.88% |

**Fallback Frequency:** 0.0%
