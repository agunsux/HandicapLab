# EPIC 35 — Live Validation Platform Implementation Reference

**Status:** COMPLETE & VERIFIED  
**Subsystem:** `src/live-validation/`

---

## Executive Summary

The Live Validation Platform is an autonomous, observer-only measurement layer operating in real-time condition over a 60–90 day observation period.

### Invariants:
1. **Observer Invariant**: Never modifies predictions, probabilities, recommendations, or parameters.
2. **Frozen Model Invariant**: Never retrains or adjusts feature weights.
3. **Immutability Invariant**: Every prediction snapshot, settlement, metric snapshot, and calibration record is append-only and protected by PostgreSQL immutability triggers.
4. **Idempotency Invariant**: Duplicate predictions and duplicate settlements per fixture are rejected with zero side-effects.

---

## Subsystem Structure

```
src/live-validation/
├── scheduler/
│   └── prediction-scheduler.ts      # Automated pre-kickoff prediction discovery & execution
├── snapshot/
│   ├── snapshot-builder.ts          # Immutable prediction builder with SHA-256 hash chains
│   ├── odds-tracker.ts              # Opening, prediction, and closing odds tracker
│   └── integrity.ts                 # Cryptographic tamper verification
├── settlement/
│   └── settlement-engine.ts         # Outcome resolution, Asian quarter lines, profit & CLV computation
├── metrics/
│   └── rolling-metrics.ts           # 7d, 30d, 90d, 365d ROI, Yield, Brier, Sharpe, Kelly metrics
├── monitoring/
│   ├── calibration-monitor.ts       # Reliability diagrams, ECE, MCE computation
│   └── drift-detector.ts            # Population Stability Index (PSI) feature & prediction drift
├── alerts/
│   ├── alert-engine.ts              # Multi-threshold alert evaluation
│   └── channels.ts                  # Multi-channel notifier (Email, Discord, Slack, Webhook)
├── reports/
│   └── weekly-report.ts             # Automated weekly scientific report generator
├── store/
│   ├── types.ts                     # LiveValidationStore interface contract
│   ├── memory-store.ts              # Memory store for fast unit testing
│   ├── file-store.ts                # Append-only JSONL file store
│   ├── supabase-store.ts            # Production Supabase PostgreSQL store
│   ├── factory.ts                   # Environment-aware store loader
│   └── index.ts                     # Unified exports
```

---

## Operational Verification

Cron endpoints are exposed at:
- `/api/cron/live-validation/scheduler`
- `/api/cron/live-validation/settlement`
- `/api/cron/live-validation/metrics`

Dashboard endpoints are accessible at:
- `/shadow-mode` (Interactive Bloomberg Terminal UI)
- `/api/live-validation/overview`
- `/api/live-validation/predictions`
- `/api/live-validation/monitoring`
- `/api/live-validation/reports`
