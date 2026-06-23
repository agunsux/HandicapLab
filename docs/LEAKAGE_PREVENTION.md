# Edge Leakage Prevention Guidelines

Data integrity is the foundation of institutional grade sports analytics. **Edge Leakage** (look-ahead bias or future-data bias) occurs when information from the future is inadvertently used during feature extraction, prediction generation, or backtesting. Preventing edge leakage is critical to ensure backtest authenticity, real-money profitability in production, and investor confidence.

---

## 🔍 What is Edge Leakage?

Edge leakage is defined as using any information in a prediction model that would not be available at the exact moment the prediction is made. 

For example, using the final score of Arsenal vs Chelsea to calculate Arsenal's pre-match form rating, or using live odds from the 80th minute of a match to generate a pre-match prediction. 

In backtests, this bias artificially inflates win rates and ROI. In production, it causes catastrophic model performance degradation and financial losses because the model relies on future signals that cannot exist when making live predictions.

---

## 🛡️ The Hard Gate: `LeakageGuard`

All pre-match operations (feature extraction, ensembling, odds capture) must be gated by the runtime checker [LeakageGuard](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/src/lib/guards/leakage.ts).

### How It Works
The `LeakageGuard.assertNoFutureData(matchId, cutoffDate)` method:
1. **Match Event Checks**: Verifies that if the cutoff date is pre-kickoff, the target match in the database must NOT have goals (`home_goals` or `away_goals`) set or have a status of `'finished'`.
2. **Prediction Timestamps Checks**: Validates that no prediction record or feature engine run has a generation timestamp (`generated_at`) greater than the cutoff date.
3. **Odds Snapshots Checks**: Asserts that no captured odds snapshot timestamp exceeds the cutoff date.

### Code Example
Always assert pre-kickoff data validity before any calculations:

```typescript
import { LeakageGuard } from '@/lib/guards/leakage';
import { FormExtractor } from './form';

export async function buildPreMatchFeatures(matchId: string, kickoffAt: Date) {
  // 1. HARD GATE: Assert that no look-ahead data exists prior to kickoff
  await LeakageGuard.assertNoFutureData(matchId, kickoffAt);

  // 2. Safe to extract historical data...
  const form = await FormExtractor.extract(matchId, kickoffAt);
  
  return {
    matchId,
    form,
    generatedAt: new Date() // Must be <= kickoffAt
  };
}
```

---

## 📋 Rules for Feature Engineering

1. **Only Pre-Kickoff Data**: Features must be derived strictly from matches completed *before* the cutoff/kickoff date.
2. **No Post-Match Stats**: Never include final match stats (e.g. shots on target, possession, final goals) for the match being predicted.
3. **Timestamp Constraints**: Every compiled feature object must record a `generatedAt` timestamp representing the exact moment it was built. This timestamp must satisfy `generatedAt <= kickoffAt`.

---

## 📋 Rules for Odds Ingestion

1. **Frozen Snapshots**: Market opening odds (stored in the `odds_snapshot` JSONB column) must be frozen at prediction time and never mutated or updated.
2. **Separate Closing Odds**: Post-match/closing odds must never overwrite the opening `odds_snapshot`. They must be stored in the dedicated `closing_odds` JSONB column only.

---

## 📋 Rules for Settlement & Updates

1. **No Prediction Mutation**: Never modify the ensembled probabilities stored in the `prediction` JSONB column during match settlement.
2. **Separate Outcomes Storage**: Settlement outcomes and calculators must write metrics (Brier score, CLV, profit/loss, hits) to separate columns or to the `prediction_results` table.

---

## 🔬 How to Audit for Leakage

1. **Automated Schema Verifier**: The verification script `verify-schema.ts` audits sample predictions. Run it via:
   ```bash
   pnpm verify:schema
   ```
   This script explicitly checks that `generated_at <= kickoff_at` and verifies odds snapshot compliance.
2. **Unit Tests**: The test suite `tests/leakage.test.ts` executes automated checks to verify that `LeakageGuard` correctly catches look-ahead attempts. Run it via:
   ```bash
   pnpm test
   ```
