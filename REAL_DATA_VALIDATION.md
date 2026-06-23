# Real Data Validation Report (Phase 1 Quick Sample)

## Model Performance Summary

| Metric | Simulated Model (Seed 42) | Real Data Model |
|--------|---------------------------|-----------------|
| **Validation Brier Score** | 0.43037 | 0.26341 |
| **Validation ROI (SH Under)** | 0.00% | 27.33% |
| **Platt Slope (A)** | 1.0909 | 0.2189 |
| **Platt Bias (B)** | -0.0691 | 0.5154 |

---

## Conditional Calibration (ECE by HT State)

| HT State | Samples | Real Model ECE | Edge Exists? |
|----------|---------|----------------|--------------|
| 0-0 | 2 | 47.92% | **NO** |
| 1-0 | 3 | 43.27% | **NO** |
| 1-1 | 3 | 76.40% | **NO** |
| 2+ | 4 | 65.94% | **NO** |

---

## State Weight Comparison

| HT State | Weight Type | Simulated Model (Seed 42) | Real Data Model |
|----------|-------------|---------------------------|-----------------|
| **0-0** | Bias | -1.0419 | -0.0999 |
| **0-0** | Tempo W | 0.0585 | 0.1326 |
| **0-0** | Pressure W | -0.4678 | -0.3591 |
| **0-0** | DefShape W | 0.1371 | -1.4149 |
| | | | |
| **1-0** | Bias | -1.1574 | 0.0827 |
| **1-0** | Tempo W | 0.0648 | 0.0609 |
| **1-0** | Pressure W | -0.5072 | 0.2977 |
| **1-0** | DefShape W | 0.0855 | -1.1945 |
| | | | |
| **0-1** | Bias | -1.1532 | -0.5221 |
| **0-1** | Tempo W | -0.0031 | 0.4729 |
| **0-1** | Pressure W | -0.5082 | -0.5160 |
| **0-1** | DefShape W | 0.0917 | -1.2234 |
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
