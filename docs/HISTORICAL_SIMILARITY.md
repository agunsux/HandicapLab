# HISTORICAL SIMILARITY ENGINE MANUAL

**Subsystem:** `src/lib/value-intelligence/similarity-engine.ts`

---

## Cohort Search & Evidence Aggregation

For every value opportunity, the Historical Similarity Engine queries historical backtests and replay databases to assemble an empirical evidence package:

### Matching Dimensions:
- **League & Competition Tier**
- **Market Type** (Moneyline, Asian Handicap, Over/Under)
- **Odds Bracket** (e.g. 1.80 - 2.10)
- **Expected Value Range** (e.g. EV &ge; +5.0%)

### Returned Evidence Metrics:
1. **Sample Size**: Total historical matches meeting cohort criteria.
2. **Historical ROI**: Realized return on investment across the cohort.
3. **Historical Hit Rate**: Percentage of winning recommendations.
4. **Historical CLV**: Average Closing Line Value retained.
5. **Max Drawdown**: Maximum historical drawdown within cohort.
6. **Calibration ECE**: Expected Calibration Error across the cohort.
