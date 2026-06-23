# HT Decomposition Report

## Conditional Metrics (by HT Score State)
| HT Score | Samples | Base Rate | ECE | Brier | ROI | Edge Exists? |
|----------|---------|-----------|-----|-------|-----|--------------|
| 0-0 | 709 | 20.2% | 3.63% | 0.1610 | 0.00% | **NO** |
| 1-0 | 934 | 16.7% | 0.39% | 0.1391 | 0.00% | **NO** |
| 1-1 | 340 | 17.1% | 2.11% | 0.1411 | 0.00% | **NO** |
| 2+ | 1017 | 14.8% | 0.88% | 0.1272 | 0.00% | **NO** |

## Interaction Test Results
| Interaction | Base Brier | New Brier | Brier Impr. | Base ROI | New ROI | ROI Impr. | Significant? |
|-------------|------------|-----------|-------------|----------|---------|-----------|--------------|
| tempo x htScore | 0.1405 | 0.1405 | -0.00001 | 0.00% | 0.00% | 0.00% | **NO** |
| pressure x htScore | 0.1405 | 0.1406 | -0.00014 | 0.00% | 0.00% | 0.00% | **NO** |
| defShape x htScore | 0.1405 | 0.1405 | -0.00007 | 0.00% | 0.00% | 0.00% | **NO** |

## Recommendation
No conditional signal found. The features provide no edge even when segmented by HT score.
