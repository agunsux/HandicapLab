# Evidence Policy

## Core Principle

Every claim made by the system must be reproducible by an independent party given:
1. The same git commit hash
2. The same input data (dataset hash)
3. The same seed

## What Constitutes Evidence

A valid evidence record contains:

```
git_commit        → code version
dataset_hash      → data version
model_version     → model version
input_data_hash   → input feature vector (SHA-256)
odds_snapshot_id  → market conditions at prediction time
prediction_prob   → model output
market_prob       → market implied probability (vig-removed)
edge              → prediction_prob - market_prob
actual_outcome    → 1 (win), 0 (loss)
clv               → closing_prob - market_prob
chain_hash        → previous evidence entry hash
```

## Evidence Chain

Every evidence entry contains a `chain_hash` that includes:
- `previous_entry_id` (or `genesis` for the first entry)
- All fields of the current record

If any entry in the chain is modified, the hash will not match and the chain is broken.

## What Is NOT Evidence

- Back-tested results (historical data seen during model development)
- Filtered subsets chosen after seeing results
- Parameters tuned on the test set
- Predictions made after the outcome was known

## Audit Trail

To verify chain integrity:

```typescript
const integrity = await evidenceStore.verifyChainIntegrity();
// { valid: true, brokenAt: null }
```

## Minimum Claims Threshold

No marketing claim can be made before:

```
- 500 settled predictions (minimum)
- 1000+ preferred
- Multiple leagues
- Multiple market types
- Multiple seasons
```

## Evidence Retention

- Evidence entries are immutable and never deleted.
- In-memory stores are for development only.
- Production requires database-backed storage.
- Git commit hash is recorded per evaluation run.
