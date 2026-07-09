# Live Validation Manifest

## Purpose

This manifest documents the exact state of the HandicapLab model and pipeline at the start of **prospective evidence collection**. All predictions made after this date are **out-of-sample, post-freeze evidence**.

No model modification — no retraining, no threshold adjustment, no manual filtering, no league cherry-picking, no odds selection based on results — will occur until the target of **500 settled predictions** is reached.

---

## Frozen Model

| Field | Value |
|-------|-------|
| **Model Version** | `v0.5-ai` |
| **Version String** | `v0.5-ai` (engine line 194) |
| **Engine File** | `src/services/probability.engine.ts` |
| **Engine Type** | Poisson-based probability model with xG, form, H2H adjustments |
| **Calibration** | Temperature scaling via `ConfidenceCalculator` + `OODDetector` |
| **Confidence** | Composite: calibration quality + stability + data coverage + OOD |
| **Feature Version** | `v1.0-features` |
| **Dataset Version** | `v1.0-dataset` |

**Commitment**: `src/services/probability.engine.ts` will not be modified until evidence collection completes.

---

## Evidence Collection Rules

### Target

| Market | Minimum | Ideal |
|--------|---------|-------|
| Asian Handicap | 150 | — |
| Over/Under | 100 | — |
| Moneyline | 50 | — |
| **Total** | **300** | **500** |

### Integrity Rules

1. **Prediction timestamp < kickoff timestamp** — no hindsight
2. **Predictions are immutable** — no updates, no deletes
3. **Evidence is chain-linked** — SHA-256 must verify before any evaluation
4. **No selective reporting** — every prediction recorded, no filtering

### Prohibited Actions


---

## Evaluation Protocol

Metrics reused from research (not duplicated):

| Domain | Metric | Source | Threshold |
|--------|--------|--------|-----------|
| Calibration | ECE | `lib/math/metrics.ts` | `< 5%` |
| Accuracy | Brier Score | `lib/math/metrics.ts` | Lower better |
| Accuracy | Log Loss | `lib/math/metrics.ts` | Lower better |
| Edge | Avg CLV | `lib/research/pipeline.ts` | `> 0` |
| Risk | Sharpe/Sortino/MaxDD | `lib/research/analytics.ts` | — |
| Confidence | Bootstrap CI 95% | `lib/research/pipeline.ts` | Lower > 0 |

### Windows

| Window | Min Predictions | Purpose |
|--------|-----------------|---------|
| 30d | 50 | Short-term monitoring only |
| 90d | 200 | Medium-term stability |
| 180d | 500 | Primary evaluation window |

---

## Milestones

### M1 — 100 Settled
Verify pipeline correctness. No performance conclusions.

### M2 — 300 Settled
**Checkpoint**: Is the model calibrated in the real world?
Output: `Sprint4_Report_v1.md`

### M3 — 500 Settled
**Decision point**: Is model edge > market noise?
Output: Commercial readiness assessment

---

## Decision Framework (at 500 settled)

| Pattern | Decision |
|---------|----------|
| CLV +, CI > 0, ECE < 5%, robust | **Shadow production → paper trading** |
| CLV +, CI crosses zero | **More data needed** → continue to 1000 |
| CLV -, ECE poor | **Revise model** |
| All negative | **Reject edge hypothesis** |

---

## Signatures

```
Model:          v0.5-ai
Engine:         services/probability.engine.ts
Hash Lock:      Deterministic — same inputs always produce same outputs
No Modification Until 500 Settled:  YES
Start Date:     2026-07-09
```

---

## References

- [Architecture](architecture.md)
- [Shadow Pipeline Operations](SHADOW_OPERATIONS.md)
- [Evidence Policy](evidence.md)
- [Operations Guide](../operational-readme.md)

| Action | Reason |
|--------|--------|
| Retraining | Invalidates out-of-sample claim |
| Threshold adjustment | Data-dependent bias |
| Manual filtering | Destroys statistical validity |
| League cherry-picking | Selection bias |
| Odds selection by result | Hindsight trading |
| Excluding losses | Fraud |
| Changing settlement rules mid-collection | Invalidates evidence chain |
