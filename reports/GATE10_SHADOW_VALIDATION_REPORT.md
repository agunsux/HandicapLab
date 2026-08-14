# GATE 10 — PROSPECTIVE SHADOW VALIDATION REPORT

**Execution Timestamp**: `2026-08-14T21:29:56.065Z`
**Operational State**: **`SHADOW_ACTIVE`**
**Sample Discipline Tier**: **`EARLY`** (15 settled bets)

---

## 1. Strategy Fidelity & Governance Alignment

| Parameter | Frozen G9 Spec | G10 Shadow Implementation | Status |
|---|---|---|:---:|
| **Strategy Version** | `G9_FROZEN_PROVISIONAL_V1` | `G9_FROZEN_PROVISIONAL_V1` | **MATCH** |
| **Model Version** | `POISSON_TEMPERATURE_SCALED_2DEAC1E` | `POISSON_TEMPERATURE_SCALED_2DEAC1E` | **MATCH** |
| **EV Threshold** | $\ge 3.0\%$ | $\ge 3.0\%$ | **MATCH** |
| **Odds Range** | `[1.40, 3.50]` | `[1.4, 3.5]` | **MATCH** |
| **Eligible Markets** | `ML, AH, OU25` | `ML, AH, OU25` | **MATCH** |
| **BTTS Status** | `DEFERRED` | `DEFERRED` | **MATCH** |
| **Staking Policy** | `Flat 1.0 Unit` | `Flat 1.0 Unit` | **MATCH** |

## 2. Market Event & Rejection Reconciliation

| Reconciliation Metric | Count | Status |
|---|---:|:---:|
| **Fixtures Discovered** | 5 | **PASS** |
| **Fixtures with Valid Kickoff** | 5 | **PASS** |
| **Market Events Evaluated** | 20 | **PASS** |
| **Shadow Bets Locked** | 15 | **PASS** |
| **Settled Shadow Bets** | 15 | **PASS** |

### Rejection Breakdown by Gate

- **`KICKOFF_IN_PAST`**: 0 rejected opportunities
- **`STALE_ODDS`**: 5 rejected opportunities
- **`UNSUPPORTED_MARKET`**: 5 rejected opportunities
- **`EV_BELOW_THRESHOLD`**: 0 rejected opportunities
- **`ODDS_OUT_OF_BOUNDS`**: 5 rejected opportunities
- **`DUPLICATE_POSITION`**: 0 rejected opportunities
- **`MISSING_PROBABILITY`**: 0 rejected opportunities
- **`INVALID_KICKOFF_TIMESTAMP`**: 0 rejected opportunities

## 3. Cryptographic Immutability & Provenance Audit

- **Total Prediction Records Checked**: 15
- **Tampered / Mutated Records**: 0 (Zero tolerance)
- **Hash Algorithm**: SHA-256 over canonical payload (fixture, market, selection, odds, probability, EV, timestamp, model_version)
- **Audit Status**: **`PASS`**
- **Anti-Leakage Verification**: **`STRICT_PRE_KICKOFF_ENFORCED`** (100% of picks generated prior to kickoff)

## 4. Current Prospective Performance

| Metric | Current Shadow Value | Note |
|---|---:|---|
| **Settled Bets** | 15 | Sample discipline tier: `EARLY` |
| **Win Rate** | 73.33% | Multi-market win rate |
| **Total P/L Units** | +5.85u | Flat 1 unit staking |
| **Realized ROI** | +39% | Early sample prospective return |
| **Mean CLV (Pinnacle)** | **+2.7%** | **Pre-kickoff vs Closing Line Beat** |
| **Positive CLV Proportion** | 100% | Bets capturing price movement |
| **Model ECE** | 1.44% | Out-of-sample calibration |
| **Max Drawdown** | 3.15u | Peak-to-trough drawdown |

## 5. Shadow Dashboard Data Contract

```json
{
  "active_predictions": 0,
  "settled_predictions": 15,
  "pending_predictions": 0,
  "mean_clv": 2.7,
  "realized_roi": 39,
  "pnl_units": 5.85,
  "calibration_ece": 1.44,
  "rejected_opportunities": 15,
  "provider_health": "HEALTHY",
  "last_run_timestamp": "2026-08-14T21:29:56.067Z",
  "data_freshness_seconds": 45
}
```
