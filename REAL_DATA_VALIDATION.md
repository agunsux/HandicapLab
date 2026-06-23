# Real Data Validation Report (Phase 1 Quick Sample)

## Model Performance Summary

| Metric | Simulated Model (Seed 42) | Real Data Model |
|--------|---------------------------|-----------------|
| **Validation Brier Score** | 0.58203 | 0.17790 |
| **Validation ROI (SH Under)** | 0.00% | 91.00% |
| **Platt Slope (A)** | 1.0909 | -0.0928 |
| **Platt Bias (B)** | -0.0691 | 0.5077 |

---

## Conditional Calibration (ECE by HT State)

| HT State | Samples | Real Model ECE | Edge Exists? |
|----------|---------|----------------|--------------|
| 1-0 | 2 | 49.21% | **NO** |
| 1-1 | 1 | 54.79% | **NO** |

---

## State Weight Comparison

| HT State | Weight Type | Simulated Model (Seed 42) | Real Data Model |
|----------|-------------|---------------------------|-----------------|
| **0-0** | Bias | -1.0419 | N/A (Fallback) |
| **0-0** | Tempo W | 0.0585 | N/A (Fallback) |
| **0-0** | Pressure W | -0.4678 | N/A (Fallback) |
| **0-0** | DefShape W | 0.1371 | N/A (Fallback) |
| | | | |
| **1-0** | Bias | -1.1574 | N/A (Fallback) |
| **1-0** | Tempo W | 0.0648 | N/A (Fallback) |
| **1-0** | Pressure W | -0.5072 | N/A (Fallback) |
| **1-0** | DefShape W | 0.0855 | N/A (Fallback) |
| | | | |
| **0-1** | Bias | -1.1532 | N/A (Fallback) |
| **0-1** | Tempo W | -0.0031 | N/A (Fallback) |
| **0-1** | Pressure W | -0.5082 | N/A (Fallback) |
| **0-1** | DefShape W | 0.0917 | N/A (Fallback) |
| | | | |
| **1-1** | Bias | -1.2015 | N/A (Fallback) |
| **1-1** | Tempo W | 0.0194 | N/A (Fallback) |
| **1-1** | Pressure W | -0.5638 | N/A (Fallback) |
| **1-1** | DefShape W | 0.1588 | N/A (Fallback) |
| | | | |
| **2+** | Bias | -1.2841 | N/A (Fallback) |
| **2+** | Tempo W | 0.1081 | N/A (Fallback) |
| **2+** | Pressure W | -0.6050 | N/A (Fallback) |
| **2+** | DefShape W | 0.1454 | N/A (Fallback) |
| | | | |
