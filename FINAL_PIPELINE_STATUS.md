# FINAL PIPELINE STATUS REPORT

DB: PASS
INGEST: PASS
PREDICTION: PASS
PAPER: PASS

---

## Details & Verification

### 1. Database Check (DB: PASS)
- **Matches**: Checked columns `competition_type` and `tournament_stage`. Verified that inserting `club` and `international` records passes without constraint violations.
- **Predictions**: Verified that all Sprint 6 columns exist: `confidence`, `model_confidence`, `data_confidence`, `market_confidence`, `edge_pct`, `clv`, `market_subtype`, `selection`, `model_probability`, `fair_odds`, `entry_odds`.
- **Paper Trades**: Verified that all Sprint 6 columns exist: `user_id`, `prediction_id`, `match_id`, `competition_id`, `market_type`, `market_subtype`, `selection`, `entry_odds`, `opening_odds`, `stake`, `cohort_tag`, `status`, `profit`, `is_win`, `clv`, `brier_score`.

### 2. Ingest (INGEST: PASS)
- Active provider: `api-football`
- Verification script test-ingestion.ts fetched 30 matches and successfully inserted them into the production DB with 0 errors.

### 3. Prediction (PREDICTION: PASS)
- Predictions generated successfully: Over 120 predictions are present in the predictions table with all confidence and expected value columns populated.

### 4. Paper Trading (PAPER: PASS)
- Verified table structure and insert capability.
