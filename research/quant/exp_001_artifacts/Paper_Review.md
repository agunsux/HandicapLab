# Paper Review: EXP-001 (Pure Probability Calibration)

## Objective
To build a reusable calibration framework and evaluate if calibrating bookmaker implied probabilities improves LogLoss and ECE using walk-forward validation.

## Dataset
Canonical Feature Store (Mock Odds version for pipeline testing)

## Validation Strategy
Walk-Forward Validation

## Calibration Methods Evaluated
Platt Scaling, Isotonic Regression, internal Beta Calibration.

## Metrics (Averaged across Walk-Forward Folds)
|    | Method       |   logloss |    brier |       ece |      mce |   adaptive_ece |   sharpness |
|---:|:-------------|----------:|---------:|----------:|---------:|---------------:|------------:|
|  0 | Uncalibrated |  0.706324 | 0.256004 | 0.0723965 | 0.245487 |      0.0897405 | 0.00471054  |
|  1 | beta         |  0.690804 | 0.248807 | 0.0267779 | 0.145215 |      0.0688804 | 0.000437176 |
|  2 | isotonic     |  0.758695 | 0.251213 | 0.0397275 | 0.305687 |      0.0549301 | 0.00334533  |
|  3 | platt        |  0.690191 | 0.248512 | 0.0255015 | 0.264615 |      0.0683605 | 7.6405e-05  |

## Statistical Significance (vs Uncalibrated)
- **platt**: p-value = 0.0110
- **isotonic**: p-value = 0.0260
- **beta**: p-value = 0.0060

## Decision
**ADOPT Isotonic**

## Next Experiment
Proceed to EXP-002: Simple Logistic Regression
