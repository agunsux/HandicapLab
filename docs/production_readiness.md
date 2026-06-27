# Production Readiness Checklist

This document details the checklist and operational boundaries for the HandicapLab data integrity and audit logging system prior to launch.

## Readiness Gate Checklist

### 1. Database
* [x] **Migrations Applied**: All SQL migrations up to `00000000000030_settlement_hardening.sql` have been successfully prepared and executed.
* [x] **Indexes Verified**: Crucial lookup fields like `correlation_id` and `signal_id` are fully indexed.
* [x] **State Mutation Guards**: Signals and predictions cannot be modified past kickoff time (kickoff lock trigger) or settlement insertion (settlement immutability trigger) unless an explicit session-based admin bypass is initialized.

### 2. Payments
* [x] **Webhook Verification**: Payment webhook endpoints successfully parse and cryptographically verify signature headers for both Stripe and Midtrans.
* [x] **Entitlement Allocation**: Backend webhook processors are verified to grant and revoke user entitlements based on normalized payment events, adhering to the absolute rule that client-side logic never grants entitlements.

### 3. Data Auditing
* [x] **Lifecycle Tracing**: Every trade signal lifecycle records `SIGNAL_CREATED`, `ODDS_CAPTURED`, `SIGNAL_LOCKED`, and `SIGNAL_SETTLED` events using a synchronized `correlation_id` shared across the audit, odds history, and settlement ledger tables.
* [x] **Integrity Audit Script**: The read-only script `check-signal-integrity.ts` scans all tables and exits with code `1` under trail breakage or code `0` under standard warnings or healthy checks.

### 4. Performance Metrics
* [x] **Sample Size Visibility**: Returns the total number of settled bets (`sample_size`) to indicate statistics significance.
* [x] **Confidence Level Indication**: Reports confidence classification (`'LOW'` for <30 signals, `'MEDIUM'` for 30-100, `'HIGH'` for >100) to keep results transparent.
* [x] **Freshness Information**: Response includes `latest_signal_at` and `latest_settlement_at` database timestamps.

---

## Known Limitations

1. **Minimum Sample Size Requirement**
   * Metrics like Average CLV require a minimum sample size of `50` settled signals to filter out statistical noise and prevent short-term variance.
2. **API Data Dependency**
   * Life-cycle capture cron jobs rely entirely on external third-party API providers (e.g. Odds API, API Football). If provider APIs fail or return malformed data, odds updates may be delayed.
3. **Bookmaker Coverage Limitations**
   * Closing line values and movement calculations are based specifically on selected benchmark bookmakers (like Pinnacle). High-frequency line moves on niche bookmakers are excluded from standard audit logs.
4. **Settlement Latency**
   * Settling matches is handled via cron jobs running periodically after match completion, which may lead to transient settlement latency.
