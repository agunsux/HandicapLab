# Signal Stability Validation Report

**Status:** UNSTABLE - Need more data

## Seed Stability Matrix

| Seed | 0-0 Pressure W | 1-0/0-1 Pressure W (Avg) | 1-1 Pressure W | 2+ Pressure W | Max State ECE | Brier Impr. | Fallback % | Verdict |
|------|----------------|--------------------------|----------------|---------------|---------------|-------------|------------|---------|
| 42 | -0.4678 | -0.5077 | -0.5638 | -0.6050 | 3.63% | 0.02233 | 0.0% | 🟢 PASS |
| 123 | -0.4623 | -0.5133 | -0.4607 | -0.5618 | 3.42% | 0.01825 | 0.0% | 🔴 FAIL |
| 456 | -0.4496 | -0.5330 | -0.5472 | -0.5881 | 3.20% | 0.02135 | 0.0% | 🟢 PASS |
| 789 | -0.4473 | -0.4952 | -0.5333 | -0.5730 | 2.14% | 0.01881 | 0.0% | 🟢 PASS |
| 1024 | -0.4865 | -0.5169 | -0.5907 | -0.6110 | 3.28% | 0.01491 | 0.0% | 🔴 FAIL |
| 2048 | -0.4559 | -0.5008 | -0.4830 | -0.5777 | 3.45% | 0.01761 | 0.0% | 🔴 FAIL |
| 3072 | -0.4826 | -0.4975 | -0.5277 | -0.5909 | 2.41% | 0.02003 | 0.0% | 🟢 PASS |
| 4096 | -0.4878 | -0.5315 | -0.5880 | -0.5640 | 2.19% | 0.01604 | 0.0% | 🔴 FAIL |
| 5120 | -0.4325 | -0.5355 | -0.4879 | -0.5933 | 2.35% | 0.01868 | 0.0% | 🔴 FAIL |
| 6144 | -0.4649 | -0.5555 | -0.5710 | -0.5856 | 3.65% | 0.02163 | 0.0% | 🟢 PASS |

## Success Criteria Evaluation
- [x] **At least 3 HT states show strong weights (mag > 0.4 & defShape > 0.05) in 8/10 seeds** (9/10 seeds)
- [ ] **Pressure weight pattern holds in 8/10 seeds (strengthens as goals increase)** (6/10 seeds)
- [x] **Conditional ECE < 5% in 8/10 seeds** (10/10 seeds)
- [x] **Brier improvement > 0.01 in 8/10 seeds** (10/10 seeds)
- [x] **Fallback frequency < 10% across all seeds** (10/10 seeds)

## Summary of Findings
- **Stable States**: All 5 HT states ('0-0', '1-0', '0-1', '1-1', '2+') consistently avoid fallback triggers across all seeds, demonstrating stable sample size distributions.
- **Pressure Pattern Consistency**: We tracked whether pressure weight strengthens (becomes more negative) as goals increase. This is physically consistent with the hypothesis that high-scoring states correspond to games where pressure exerts more influence on pacing/pushed lines.
- **Calibration & Brier Improvement**: Conditional calibration remains extremely tight under Platt Scaling, while state-specific weights provide a robust Brier score improvement compared to the global model.

## Final Verdict
**UNSTABLE**
The patterns are highly seed-dependent and indicate potential overfitting to the mock generator configuration. We need to investigate state coefficient regularization or adjust the feature generator before moving to real data.
