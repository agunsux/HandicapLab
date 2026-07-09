# Pipeline Reliability Contracts

**Generated**: 2026-07-09T18:24:18.822Z
**Pipeline Steps**: 7

This document is auto-generated from the TypeScript contract definitions in `src/lib/pipeline/contracts/`.
Each contract is the source of truth for state machine transitions, recovery strategies, and observability.

---

## Pipeline Dependency Graph

```
feature_engineering
capture_opening
```

---

## Feature Engineering (`feature_engineering`)

Computes match-level features from historical data, team stats, and market data.

### Input

- **Type**: `FeatureInput`
- **Required fields**: fixtureId, homeTeam, awayTeam, league, season
- **Description**: Fixture with historical context needed to compute features

### Output

- **Type**: `FeatureOutput`
- **Guaranteed fields**: featureVersion, featureCount, features
- **Description**: Feature vector for the prediction model

### Preconditions

- [critical] Fixture must exist in database
  - Check: `exists:fixtureId`
- [warning] Historical data available for both teams (min 5 matches)
  - Check: `exists:homeTeam`

### Postconditions

- [hard] Feature vector complete with no null values
  - Check: `exists:features`
- [hard] Feature version tagged for reproducibility
  - Check: `exists:featureVersion`

### Reliability

| Property | Value |
|---|---|
| Retry Policy | No retry |
| Timeout | 30000ms |
| Idempotency | Idempotency key on: fixture_id, feature_version |
| Failure Mode | blocking |
| Recovery | {"type":"dead_letter_queue"} |
| Dependencies | None |

### Metrics

| Name | Type | Description |
|---|---|---|
| `feature_engineering_latency_ms` | timer | Execution time for feature_engineering step |
| `feature_engineering_success_total` | counter | Total successful feature_engineering executions |
| `feature_engineering_failure_total` | counter | Total failed feature_engineering executions |
| `features_computed_total` | counter | Feature vectors computed |
| `features_null_total` | counter | Feature vectors with null values |

---

## Prediction Generation (`prediction`)

Generates model predictions for a fixture using engineered features and market odds.

### Input

- **Type**: `PredictionInput`
- **Required fields**: fixtureId, homeTeam, awayTeam, league, kickoff, features, openingOdds
- **Description**: Fixture with features and odds needed to compute predictions

### Output

- **Type**: `PredictionOutput`
- **Guaranteed fields**: homeProb, drawProb, awayProb, expectedGoals, confidence, modelVersion
- **Description**: Computed probabilities and recommended markets

### Preconditions

- [critical] Fixture must exist
  - Check: `exists:fixtureId`
- [critical] Features must be computed and ready
  - Check: `exists:features`
- [warning] Opening odds must be available (for edge calculation)
  - Check: `exists:openingOdds`
- [critical] Kickoff must be in the future (no post-hoc predictions)
  - Check: `exists:kickoff`

### Postconditions

- [hard] Prediction must have valid probability distribution (sum ≈ 1.0)
  - Check: `type:number:homeProb`
- [hard] Prediction must be persisted to database
  - Check: `exists:predictionId`
- [hard] Model version must be recorded for audit
  - Check: `exists:modelVersion`

### Reliability

| Property | Value |
|---|---|
| Retry Policy | No retry |
| Timeout | 30000ms |
| Idempotency | Idempotency key on: fixture_id, model_version, feature_version |
| Failure Mode | blocking |
| Recovery | {"type":"manual_intervention"} |
| Dependencies | feature_engineering |

### Metrics

| Name | Type | Description |
|---|---|---|
| `prediction_latency_ms` | timer | Execution time for prediction step |
| `prediction_success_total` | counter | Total successful prediction executions |
| `prediction_failure_total` | counter | Total failed prediction executions |
| `predictions_generated_total` | counter | Total predictions generated |
| `predictions_high_confidence_total` | counter | High confidence predictions |

---

## Opening Odds Capture (`capture_opening`)

Captures the first odds snapshot for a fixture as soon as it becomes available.

### Input

- **Type**: `CaptureInput`
- **Required fields**: fixtureId, homeTeam, awayTeam, league
- **Description**: Fixture reference for odds capture

### Output

- **Type**: `CaptureOutput`
- **Guaranteed fields**: fixtureId, marketType, homeOdds, awayOdds, drawOdds, capturedAt, provider
- **Description**: Odds snapshot for all three markets

### Preconditions

- [critical] Fixture must exist and be upcoming
  - Check: `exists:fixtureId`
- [warning] Provider must be healthy (checked within last 5 min)
  - Check: `exists:provider`

### Postconditions

- [hard] Opening odds stored in market_movements
  - Check: `exists:capturedAt`
- [soft] All three markets attempted (ML, AH, OU)
  - Check: `exists:marketType`

### Reliability

| Property | Value |
|---|---|
| Retry Policy | Exponential backoff (max 3, base 2000ms) |
| Timeout | 15000ms |
| Idempotency | Dedup window 86400000ms on: fixture_id, market_type |
| Failure Mode | non_blocking |
| Recovery | {"type":"dead_letter_queue"} |
| Dependencies | None |

### Metrics

| Name | Type | Description |
|---|---|---|
| `capture_opening_latency_ms` | timer | Execution time for capture_opening step |
| `capture_opening_success_total` | counter | Total successful capture_opening executions |
| `capture_opening_failure_total` | counter | Total failed capture_opening executions |
| `opening_odds_captured_total` | counter | Opening odds snapshots captured |
| `market_movements_stored_total` | counter | Market movement records stored |

---

## Closing Odds Capture (Periodic) (`capture_closing`)

Captures odds at multiple time windows before kickoff. The closest capture to kickoff becomes the canonical closing line.

### Input

- **Type**: `CaptureInput`
- **Required fields**: fixtureId, homeTeam, awayTeam, kickoff
- **Description**: Fixture reference with kickoff time for phase calculation

### Output

- **Type**: `CaptureOutput`
- **Guaranteed fields**: fixtureId, marketType, capturePhase, closingUpdated
- **Description**: Odds snapshots at nearest applicable phase, with closing_odds updated if phase is T-15m or closer

### Preconditions

- [warning] Fixture must have an opening odds capture
  - Check: `exists:openingCapture`
- [critical] Fixture is not yet finished
  - Check: `exists:fixtureId`

### Postconditions

- [hard] Market movement recorded (or idempotent no-op)
  - Check: `exists:capturePhase`
- [soft] Closing odds updated if within T-15m, T-5m, or kickoff phase
  - Check: `exists:closingUpdated`
- [hard] Capture delay logged (seconds before kickoff)
  - Check: `exists:capturePhase`

### Reliability

| Property | Value |
|---|---|
| Retry Policy | Exponential backoff (max 3, base 5000ms) |
| Timeout | 20000ms |
| Idempotency | Upsert on: match_id, market_type, capture_phase, provider |
| Failure Mode | non_blocking |
| Recovery | {"type":"dead_letter_queue"} |
| Dependencies | capture_opening |

### Metrics

| Name | Type | Description |
|---|---|---|
| `capture_closing_latency_ms` | timer | Execution time for capture_closing step |
| `capture_closing_success_total` | counter | Total successful capture_closing executions |
| `capture_closing_failure_total` | counter | Total failed capture_closing executions |
| `closing_odds_updated_total` | counter | Closing odds records updated |
| `market_movements_stored_total` | counter | Market movements stored |
| `capture_retry_total` | counter | Capture retry attempts |
| `capture_timeout_total` | counter | Capture timeouts |

---

## Match Settlement (`settlement`)

Records actual match result and compares against predictions to determine hits and profit/loss.

### Input

- **Type**: `SettlementInput`
- **Required fields**: fixtureId, homeScore, awayScore, predictionId
- **Description**: Finished match with actual score and predictions

### Output

- **Type**: `SettlementOutput`
- **Guaranteed fields**: fixtureId, actualHomeScore, actualAwayScore, hit1x2, hitAH, hitOU
- **Description**: Settlement record with hit/miss for each market and profit/loss

### Preconditions

- [critical] Match must be finished (actual score exists)
  - Check: `exists:homeScore`
- [critical] Prediction must exist for this fixture
  - Check: `exists:predictionId`

### Postconditions

- [hard] Settlement record persisted in prediction_results
  - Check: `exists:fixtureId`
- [hard] All three markets settled (1X2, AH, OU)
  - Check: `exists:hitAH`
- [soft] Profit/Loss calculated for all markets
  - Check: `exists:hit1x2`

### Reliability

| Property | Value |
|---|---|
| Retry Policy | No retry |
| Timeout | 10000ms |
| Idempotency | Idempotency key on: match_id, prediction_id |
| Failure Mode | blocking |
| Recovery | {"type":"manual_intervention"} |
| Dependencies | prediction, capture_closing |

### Metrics

| Name | Type | Description |
|---|---|---|
| `settlement_latency_ms` | timer | Execution time for settlement step |
| `settlement_success_total` | counter | Total successful settlement executions |
| `settlement_failure_total` | counter | Total failed settlement executions |
| `settlements_completed_total` | counter | Matches settled |
| `settlements_hit_1x2_total` | counter | Correct 1X2 predictions |
| `settlements_hit_ah_total` | counter | Correct AH predictions |
| `settlements_hit_ou_total` | counter | Correct OU predictions |

---

## CLV Computation (`clv`)

Computes Closing Line Value — the log ratio of model price to closing market price.

### Input

- **Type**: `CLVInput`
- **Required fields**: predictionId, fixtureId, marketType, modelPrice, closingPrice
- **Description**: Prediction and corresponding closing odds

### Output

- **Type**: `CLVOutput`
- **Guaranteed fields**: clv, clvBps, edgeVsClosing
- **Description**: CLV in basis points and edge vs closing line

### Preconditions

- [critical] Prediction must exist and be settled
  - Check: `exists:predictionId`
- [critical] Closing odds must exist for this fixture/market
  - Check: `exists:closingPrice`

### Postconditions

- [hard] CLV calculated and stored in clv_results
  - Check: `exists:clv`
- [hard] CLV expressed in both decimal and basis points
  - Check: `exists:clvBps`

### Reliability

| Property | Value |
|---|---|
| Retry Policy | No retry |
| Timeout | 5000ms |
| Idempotency | Upsert on: prediction_id, market_type |
| Failure Mode | non_blocking |
| Recovery | {"type":"dead_letter_queue"} |
| Dependencies | settlement, capture_closing |

### Metrics

| Name | Type | Description |
|---|---|---|
| `clv_latency_ms` | timer | Execution time for clv step |
| `clv_success_total` | counter | Total successful clv executions |
| `clv_failure_total` | counter | Total failed clv executions |
| `clv_calculated_total` | counter | CLV values computed |
| `clv_positive_total` | counter | CLV > 0 (model beat market) |
| `clv_negative_total` | counter | CLV < 0 (market beat model) |

---

## Evidence Ledger Write (`ledger`)

Writes the complete prediction-settlement-CLV record to the immutable evidence ledger.

### Input

- **Type**: `LedgerInput`
- **Required fields**: predictionId, fixtureId, modelVersion, marketType, predictionProb, marketProb, edge, clv
- **Description**: Complete prediction record with settlement and CLV

### Output

- **Type**: `LedgerOutput`
- **Guaranteed fields**: entryId, chainHash, previousEntryId
- **Description**: Ledger entry with chain hash for integrity verification

### Preconditions

- [critical] Prediction must exist and be settled
  - Check: `exists:predictionId`
- [critical] CLV must be computed
  - Check: `exists:clv`
- [warning] Previous ledger entry hash available for chaining
  - Check: `exists:previousEntryId`

### Postconditions

- [hard] Ledger entry persisted with valid chain hash
  - Check: `exists:chainHash`
- [hard] Chain integrity verified (hash matches previous entry)
  - Check: `exists:previousEntryId`

### Reliability

| Property | Value |
|---|---|
| Retry Policy | No retry |
| Timeout | 10000ms |
| Idempotency | Idempotency key on: prediction_id, event_type |
| Failure Mode | blocking |
| Recovery | {"type":"manual_intervention"} |
| Dependencies | prediction, settlement, clv |

### Metrics

| Name | Type | Description |
|---|---|---|
| `ledger_latency_ms` | timer | Execution time for ledger step |
| `ledger_success_total` | counter | Total successful ledger executions |
| `ledger_failure_total` | counter | Total failed ledger executions |
| `ledger_written_total` | counter | Ledger entries written |
| `ledger_chain_verified_total` | counter | Chain integrity verifications |
| `ledger_chain_broken_total` | counter | Chain integrity failures |

---

## Summary

### Failure Modes

| Step | Failure Mode | Recovery |
|---|---|---|
| feature_engineering | blocking | {"type":"dead_letter_queue"} |
| prediction | blocking | {"type":"manual_intervention"} |
| capture_opening | non_blocking | {"type":"dead_letter_queue"} |
| capture_closing | non_blocking | {"type":"dead_letter_queue"} |
| settlement | blocking | {"type":"manual_intervention"} |
| clv | non_blocking | {"type":"dead_letter_queue"} |
| ledger | blocking | {"type":"manual_intervention"} |

### Retry Policies

| Step | Policy |
|---|---|
| feature_engineering | No retry |
| prediction | No retry |
| capture_opening | Exponential backoff (3x) |
| capture_closing | Exponential backoff (3x) |
| settlement | No retry |
| clv | No retry |
| ledger | No retry |

### Idempotency

| Step | Scheme | Keys |
|---|---|---|
| feature_engineering | idempotency_key | {"type":"idempotency_key","keyFields":["fixture_id","feature_version"]} |
| prediction | idempotency_key | {"type":"idempotency_key","keyFields":["fixture_id","model_version","feature_version"]} |
| capture_opening | dedup_window | {"type":"dedup_window","windowMs":86400000,"keyFields":["fixture_id","market_type"]} |
| capture_closing | upsert | {"type":"upsert","uniqueFields":["match_id","market_type","capture_phase","provider"]} |
| settlement | idempotency_key | {"type":"idempotency_key","keyFields":["match_id","prediction_id"]} |
| clv | upsert | {"type":"upsert","uniqueFields":["prediction_id","market_type"]} |
| ledger | idempotency_key | {"type":"idempotency_key","keyFields":["prediction_id","event_type"]} |

### Metrics

| Step | Metric | Type |
|---|---|---|
| feature_engineering | `feature_engineering_latency_ms` | timer |
| feature_engineering | `feature_engineering_success_total` | counter |
| feature_engineering | `feature_engineering_failure_total` | counter |
| feature_engineering | `features_computed_total` | counter |
| feature_engineering | `features_null_total` | counter |
| prediction | `prediction_latency_ms` | timer |
| prediction | `prediction_success_total` | counter |
| prediction | `prediction_failure_total` | counter |
| prediction | `predictions_generated_total` | counter |
| prediction | `predictions_high_confidence_total` | counter |
| capture_opening | `capture_opening_latency_ms` | timer |
| capture_opening | `capture_opening_success_total` | counter |
| capture_opening | `capture_opening_failure_total` | counter |
| capture_opening | `opening_odds_captured_total` | counter |
| capture_opening | `market_movements_stored_total` | counter |
| capture_closing | `capture_closing_latency_ms` | timer |
| capture_closing | `capture_closing_success_total` | counter |
| capture_closing | `capture_closing_failure_total` | counter |
| capture_closing | `closing_odds_updated_total` | counter |
| capture_closing | `market_movements_stored_total` | counter |
| capture_closing | `capture_retry_total` | counter |
| capture_closing | `capture_timeout_total` | counter |
| settlement | `settlement_latency_ms` | timer |
| settlement | `settlement_success_total` | counter |
| settlement | `settlement_failure_total` | counter |
| settlement | `settlements_completed_total` | counter |
| settlement | `settlements_hit_1x2_total` | counter |
| settlement | `settlements_hit_ah_total` | counter |
| settlement | `settlements_hit_ou_total` | counter |
| clv | `clv_latency_ms` | timer |
| clv | `clv_success_total` | counter |
| clv | `clv_failure_total` | counter |
| clv | `clv_calculated_total` | counter |
| clv | `clv_positive_total` | counter |
| clv | `clv_negative_total` | counter |
| ledger | `ledger_latency_ms` | timer |
| ledger | `ledger_success_total` | counter |
| ledger | `ledger_failure_total` | counter |
| ledger | `ledger_written_total` | counter |
| ledger | `ledger_chain_verified_total` | counter |
| ledger | `ledger_chain_broken_total` | counter |
