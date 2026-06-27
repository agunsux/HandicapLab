# Signal Audit Event Payload Contracts

This document defines the schema and contract definitions for events logged inside the `signal_audit_events` table.

## Common Fields
Every audit event contains the following metadata structure:
* `id` (UUID): Primary key identifying the log event.
* `signal_id` (UUID): References the source signal or prediction.
* `event_type` (TEXT): Categorizes the lifecycle milestone.
* `correlation_id` (UUID): Links all events in a signal's lifecycle.
* `source` (TEXT): Execution context metadata (`signal_scanner`, `capture_odds_cron`, `settlement_cron`).
* `payload` (JSONB): Structured event details.
* `created_at` (TIMESTAMPTZ): Log timestamp.

---

## Event Payload Contracts

### 1. `SIGNAL_CREATED`
Fired when a statistical edge is scanned and inserted as a signal.
* **Source**: `signal_scanner`
* **Payload Format**:
  ```json
  {
    "match_id": "string",
    "market": "string",
    "handicap_line": 0.0,
    "selection": "string",
    "odds": 0.0
  }
  ```

### 2. `ODDS_CAPTURED`
Fired when market closing lines and odds are captured before kickoff.
* **Source**: `capture_odds_cron`
* **Payload Format**:
  ```json
  {
    "old_line": 0.0,
    "new_line": 0.0,
    "old_odds": 0.0,
    "new_odds": 0.0,
    "provider": "string"
  }
  ```

### 3. `LINE_MOVED`
Fired when a line shift occurs between signal opening and closing.
* **Source**: `capture_odds_cron`
* **Payload Format**:
  ```json
  {
    "old_line": 0.0,
    "new_line": 0.0,
    "old_odds": 0.0,
    "new_odds": 0.0,
    "provider": "string"
  }
  ```

### 4. `SIGNAL_SETTLED`
Fired when match outcomes are resolved and performance metrics are calculated.
* **Source**: `settlement_cron`
* **Payload Format**:
  ```json
  {
    "result": "string",
    "pnl": 0.0,
    "roi": 0.0,
    "closing_line": 0.0,
    "clv": 0.0
  }
  ```
