# HANDICAPLAB — QUANT VALIDATION

Principle: show performance exactly as computed, including negative results.
Reproducible evidence only. If performance is −3.2%, show −3.2%.

## 1. Persisted walk-forward artifact (source of truth)

`data/reports/homepage_backtest_latest.json`

| Metric | Value (latest artifact) |
| --- | --- |
| Status | expanding-window walk-forward, out-of-sample |
| Total bets | ~8,455 |
| Portfolio ROI | **−5.37%** |
| Mean CLV | real closing reference |
| ML ROI | −6.24% |
| AH ROI | −0.51% |
| OU ROI | −6.23% |
| BTTS | **no historical prices ingested → INSUFFICIENT_DATA** |

The homepage (`Market Intelligence`, `Historical Data`) renders these real
values and labels them with `REAL`/`INSUFFICIENT_DATA` states. It never
substitutes the quarantined EPIC-66 discovery numbers.

## 2. Quant validation domains

### Prediction quality
- Brier Score — real buckets computed from `prediction_audits` when
  settled sample ≥ 30 (see `/api/evidence`).
- Log loss, calibration reliability diagram, calibration error (ECE).

### Market performance
- ROI / Yield, hit rate, drawdown, turnover, sample size.
- Never present ROI without sample size and methodology.

### CLV
- Requires real entry odds, closing odds, timestamps, market line.
- If closing data unavailable → `CLV = UNAVAILABLE`.
- `selectEntryAndClosing()` in the native odds normalizer returns entry/closing
  nulls instead of fabricating a price.

## 3. Calibration

- Odds calibration splits: ML uses temperature scaling; OU/AH/BTTS use Platt
  scaling fitted per-fold on train seasons only.
- Reliability buckets are computed live from settled binary records.

## 4. Settlement

- AH supports quarter/half lines and win/loss/push/half-win/half-loss.
- OU supports goal lines incl. quarter lines with the same settlement struct.
- Split-line markets use settlement-aware EV, not a blind binary formula.

## 5. Sharp market reference (2026-09-11)

`SharpConsensusEngine` (src/lib/market-intelligence/sharpConsensus.ts):

- per-source de-vig through the canonical `removeVig` layer,
- S1 (Pinnacle/SBOBet/Betfair Ex) weighted above S2 (Singbet/Marathonbet),
- line preservation enforced (never combine −0.5 and −0.75),
- exchange prices commission/spread/liquidity adjusted,
- source quality is downgraded dynamically
  (`LOW_SOURCE_DIVERSITY`, `NO_S1_SOURCES`),
- `compareModelToConsensus` and `computeRetailDivergence` classify, they do
  not promote edges.

## 6. Invariants

- No future leakage: features never use data timestamped ≥ kickoff.
- No extraordinary result without audit: any ROI > 10% triggers the audit
  engine before it can reach the UI (EPIC-66 was quarantined under this rule).
- CLV is measured against a documented closing reference (Pinnacle primary).

## 7. Verification

- `tests/sharp-consensus.test.ts`
- `tests/evidenceCenter.test.ts`
- `tests/api/epic67_public_endpoints.test.ts`
- existing settlement/E2E over-under/asian-handicap tests
