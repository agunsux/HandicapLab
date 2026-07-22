# LIVE VALIDATION ARCHITECTURE MANUAL

**Document Version:** 1.0.0  
**Scope:** `src/live-validation/`  

---

## 1. System Invariants & Isolation

The Live Validation Platform operates as a strict **Observer Pattern**:

```
+-------------------+       Reads        +-----------------------+
|  Prediction Engine | <----------------- | Live Validation Engine|
+-------------------+                    +-----------------------+
         |                                           |
    [Predictions]                              [Appends Only]
         |                                           v
         v                               +-----------------------+
    Immutable                             |  prediction_snapshots |
  Model Outputs                           |  odds_snapshots       |
                                          |  settlements          |
                                          +-----------------------+
```

### Key Technical Safeguards:
- **No Reverse Coupling**: Core probability engines never import `live-validation`.
- **Database Engine Guards**: `BEFORE UPDATE OR DELETE` PostgreSQL triggers throw errors on mutation.
- **Audit Cryptography**: Snapshots maintain a SHA-256 chain where `chainHash_N = SHA256(snapshot_N || chainHash_{N-1})`.

---

## 2. Idempotency & Retries

- `PredictionScheduler` checks idempotency key `prediction:{fixtureId}:{modelVersion}` before executing.
- Execution is wrapped in exponential backoff retries and explicit timeouts (`withTimeout`, `withRetry`).
- Settled bets require `settlement:{predictionId}:{market}` which ensures 0 duplicate settlements under all network retry scenarios.
