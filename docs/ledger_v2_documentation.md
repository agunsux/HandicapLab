# Prediction Ledger v2 System Documentation

This document describes the schema architecture, design patterns, lifecycle flow, data dictionary, data sizing estimation, and maintenance policies for the **HandicapLab Prediction Ledger v2**.

---

## 1. Entity Relationship Diagram (ERD)

The ledger utilizes a star-schema-like design where `prediction_snapshots` serves as the central fact table partitioned by `snapshot_time`. All diagnostic, market, feature, and settlement tables relate back to this central snapshot.

```mermaid
erDiagram
    schema_migrations_meta {
        text migration_name PK
        text checksum
        timestamptz applied_at
        varchar schema_version
    }
    
    prediction_snapshots {
        uuid snapshot_id PK
        timestamptz snapshot_time PK
        uuid id
        uuid prediction_uuid
        text match_id
        timestamptz kickoff_time
        text league
        text season
        text market
        text selection
        text line
        double_precision odds
        double_precision opening_odds
        double_precision closing_odds
        double_precision probability_home
        double_precision probability_draw
        double_precision probability_away
        double_precision expected_goals_home
        double_precision expected_goals_away
        double_precision confidence_score
        double_precision data_quality_score
        varchar recommendation_label
        varchar model_version
        varchar engine_version
        varchar git_commit
        jsonb provider_versions
        jsonb weather
        text stadium
        text timezone
        jsonb formation
        jsonb injuries
        jsonb lineups
        jsonb elo_snapshot
        jsonb xg_snapshot
        jsonb feature_vector
        jsonb probability_vector
        jsonb calibration_metadata
        text hash_fingerprint
        varchar hash_algorithm
        uuid parent_prediction_uuid
        jsonb prediction
        numeric confidence
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_snapshot_features {
        uuid id PK
        uuid snapshot_id FK
        timestamptz snapshot_time
        text feature_name
        double_precision feature_value
        double_precision normalized_value
        double_precision weight
        double_precision importance
        jsonb source_provenance
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_snapshot_markets {
        uuid id PK
        uuid snapshot_id FK
        timestamptz snapshot_time
        double_precision pinnacle_odds
        double_precision bet365_odds
        double_precision betfair_odds
        double_precision market_average
        double_precision market_median
        double_precision opening_odds
        double_precision current_odds
        double_precision implied_prob
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_snapshot_explainability {
        uuid id PK
        uuid snapshot_id FK
        timestamptz snapshot_time
        jsonb positive_factors
        jsonb negative_factors
        jsonb uncertainty_factors
        jsonb missing_data
        jsonb shap_values
        jsonb feature_importance
        jsonb reasoning_tree
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_snapshot_execution {
        uuid id PK
        uuid snapshot_id FK
        timestamptz snapshot_time
        int execution_time_ms
        int api_latency_ms
        int provider_latency_ms
        text cron_id
        text worker_id
        text git_commit
        text docker_image
        varchar environment
        int retry_count
        jsonb provider_failures
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_model_versions {
        uuid prediction_uuid PK
        text engine_version
        text feature_version
        text elo_version
        text calibration_version
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_settlements {
        uuid settlement_id PK
        uuid prediction_uuid FK
        uuid snapshot_id
        jsonb match_result
        double_precision closing_odds
        double_precision line_movement
        double_precision clv
        double_precision kelly_recommended
        double_precision brier_contribution
        double_precision logloss_contribution
        text settlement_reason
        double_precision roi
        double_precision profit
        double_precision loss
        boolean paper_trade
        varchar calibration_bucket
        varchar reliability_bucket
        timestamptz settled_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_calibration_metrics {
        uuid id PK
        varchar bucket
        double_precision predicted_prob
        double_precision actual_prob
        double_precision ece
        double_precision mce
        double_precision brier
        double_precision logloss
        varchar reliability_bucket
        double_precision historical_percentile
        varchar confidence_bucket
        timestamptz evaluated_at
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_feedback {
        uuid id PK
        uuid prediction_uuid FK
        jsonb feature_drift
        jsonb model_drift
        jsonb market_efficiency
        timestamptz recorded_at
        timestamptz created_at
        varchar created_by
        varchar source_system
        varchar schema_version
    }

    prediction_snapshots ||--o{ prediction_snapshot_features : "has features"
    prediction_snapshots ||--o{ prediction_snapshot_markets : "has markets"
    prediction_snapshots ||--o{ prediction_snapshot_explainability : "has explainability"
    prediction_snapshots ||--o{ prediction_snapshot_execution : "has execution meta"
    prediction_snapshots ||--|| prediction_model_versions : "has version metadata"
    prediction_snapshots ||--o| prediction_settlements : "has settlement result"
    prediction_snapshots ||--o{ prediction_feedback : "has feedback loops"
```

---

## 2. Quantitative Architecture Lifecycle

```
[ Match scheduled ]
       │
       ▼
[ Feature Engine ]  ──(Build advanced inputs, e.g. ELO, goal pressure, fatigue)
       │
       ▼
[ Probability Engine ] ──(Dixon-Coles & Poisson distributions + Platt scaling calibration)
       │
       ▼
[ Edge Scanner ] ──(Find EV inefficiencies vs Pinnacle/Bet365 current bookmaker prices)
       │
       ├──────────────────────────────────────┐
       ▼ (Dual-Write)                         ▼ (Dual-Write)
[ Cache Table (Mutable) ]              [ Immutable Ledger Tables ]
- public.predictions                   - public.prediction_snapshots
- public.paper_trades                  - public.prediction_snapshot_features
                                       - public.prediction_snapshot_markets
                                       - public.prediction_snapshot_explainability
                                       - public.prediction_snapshot_execution
                                       - public.prediction_model_versions
                                              │
                                              ▼
                                       (Triggers Prevent UPDATES)
                                              │
                                              ▼ (Settlement Cron Runs)
                                       [ Settlement Pipeline ]
                                       - Settle match outcomes
                                       - Compute CLV (Closing Line Value)
                                       - Compute Brier / LogLoss metrics
                                       - Insert into public.prediction_settlements
                                       - Update public.prediction_calibration_metrics
                                       - Update public.prediction_feedback
```

---

## 3. Data Dictionary

### 3.1 `prediction_snapshots` (Fact Table, Partitioned)
- `snapshot_id` (UUID PK): Unique identifier for the snapshot.
- `prediction_uuid` (UUID): Identifier linking the prediction logically across version tables.
- `match_id` (TEXT): ID of the fixture.
- `snapshot_time` (TIMESTAMPTZ PK): Partition key. Time the snapshot was recorded.
- `recommendation_label` (VARCHAR): Conviction tier mapping (`High Conviction`, `Medium Conviction`, `Low Conviction`, `Observation`).
- `hash_fingerprint` (TEXT): SHA-256 string fingerprinting all inputs and probabilities.

### 3.2 `prediction_snapshot_features`
- `snapshot_id` (UUID): Reference to base snapshot.
- `feature_name` (TEXT): Name of the feature (e.g., `pressureFactor`, `fatigueFactor`).
- `feature_value` (DOUBLE PRECISION): Raw value.

### 3.3 `prediction_settlements`
- `settlement_id` (UUID PK): Unique settlement transaction ID.
- `prediction_uuid` (UUID): Associated prediction uuid.
- `clv` (DOUBLE PRECISION): Outperformance of opening odds vs closing odds.
- `brier_contribution` (DOUBLE PRECISION): Brier score component $(p - y)^2$.
- `logloss_contribution` (DOUBLE PRECISION): Logarithmic loss component.

---

## 4. Maintenance, Backup & Restore Strategy

### 4.1 Database Backup
Ledger tables are mission-critical. Weekly logical dumps and point-in-time recovery (PITR) must be configured:
```bash
# Export schema and data for ledger tables specifically
pg_dump -h <host> -U postgres -d postgres -t "public.prediction_snapshots*" -t "public.prediction_settlements" --clean --no-owner -f ledger_v2_backup.sql
```

### 4.2 Disaster Recovery / Restore
To restore ledger tables safely:
1. Temporarily disable the `enforce_snapshot_immutability` trigger:
   ```sql
   ALTER TABLE public.prediction_snapshots DISABLE TRIGGER enforce_snapshot_immutability;
   ```
2. Import the backup file.
3. Re-enable the immutability trigger:
   ```sql
   ALTER TABLE public.prediction_snapshots ENABLE TRIGGER enforce_snapshot_immutability;
   ```

---

## 5. Storage Sizing & Sizing Estimations

Since the ledger records structured arrays (features, odds, explainability vectors) in normalized relation columns instead of heavy unstructured JSON, database sizes scale linearly.

| Prediction Count | Core Snapshots (Fact) | Features (10/snap) | Explainability/Execution | Total Storage |
|---|---|---|---|---|
| **1,000,000** | ~350 MB | ~1.2 GB | ~450 MB | **~2.0 GB** |
| **10,000,000** | ~3.5 GB | ~12.0 GB | ~4.5 GB | **~20.0 GB** |
| **100,000,000** | ~35.0 GB | ~120.0 GB | ~45.0 GB | **~200.0 GB** |

### Recommendations for Large-Scale Data Sizing:
- **Partition Pruning:** Always include `snapshot_time` in query `WHERE` clauses to prevent table scans across multiple years.
- **Data Retention & Archiving:** Features older than 18 months can be archived to cold storage (e.g. AWS S3 or Supabase Storage) as CSVs, keeping only the base `prediction_snapshots` and `prediction_settlements` tables online in the Postgres database.
