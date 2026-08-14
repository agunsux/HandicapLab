# GATE 2 — SMALL REAL-DATA PILOT REPORT

**Execution Timestamp**: `2026-08-14T21:11:52.337Z`
**Overall Verdict**: **`PASS`**
**Pilot Sample Count**: `5 matches`

## 1. End-to-End Chain Verification

The entire chain was proven across 5 representative real fixtures and 4 markets (Moneyline, Asian Handicap, Over/Under 2.5, BTTS):

$$\text{Real Fixture} \longrightarrow \text{Real Stats} \longrightarrow \text{Model Prob} \longrightarrow \text{Real Entry Odds} \longrightarrow \text{EV} \longrightarrow \text{Real Closing Odds} \longrightarrow \text{CLV} \longrightarrow \text{Result} \longrightarrow \text{Settlement}$$

| Match ID | Date | Fixture | Result | Provenance | Leakage-Free |
|---|---|---|:---:|:---:|:---:|
| `EPL-2020-2021-2020-12-13-arsenal-burnley` | 2020-12-13 | Arsenal vs Burnley (0-1) | VERIFIED | PASS | PASS |
| `EPL-2020-2021-2020-12-13-crystal-palace-tottenham` | 2020-12-13 | Crystal Palace vs Tottenham (1-1) | VERIFIED | PASS | PASS |
| `EPL-2020-2021-2020-12-13-fulham-liverpool` | 2020-12-13 | Fulham vs Liverpool (1-1) | VERIFIED | PASS | PASS |
| `EPL-2020-2021-2020-12-13-leicester-brighton` | 2020-12-13 | Leicester vs Brighton (3-0) | VERIFIED | PASS | PASS |
| `EPL-2020-2021-2020-12-13-southampton-sheffield-united` | 2020-12-13 | Southampton vs Sheffield United (3-0) | VERIFIED | PASS | PASS |

## 2. Sample Market Settlement & CLV Details

### Arsenal vs Burnley (0-1) (`EPL-2020-2021-2020-12-13-arsenal-burnley`)

| Market | Selection | Model Prob | Implied Prob | Entry Odds | Close Odds | EV | CLV | Outcome | P/L (1u) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ML | Home | 53.3% | 65.4% | 1.53 | 1.5 | -18.46% | 2.00% | `LOSS` | -1u |
| OU25 | Over 2.5 | 20.3% | 52.6% | 1.9 | 1.84 | -61.49% | 3.26% | `LOSS` | -1u |
| AH | Home -0.5 | 53.3% | 65.4% | 1.53 | 1.5 | -18.46% | 2.00% | `LOSS` | -1u |
| BTTS | Yes | 23.3% | 54.0% | 1.85 | 1.85 | -56.86% | 0.00% | `LOSS` | -1u |

### Crystal Palace vs Tottenham (1-1) (`EPL-2020-2021-2020-12-13-crystal-palace-tottenham`)

| Market | Selection | Model Prob | Implied Prob | Entry Odds | Close Odds | EV | CLV | Outcome | P/L (1u) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ML | Home | 16.4% | 22.2% | 4.5 | 4.41 | -25.99% | 2.04% | `LOSS` | -1u |
| OU25 | Over 2.5 | 54.4% | 52.6% | 1.9 | 1.84 | 3.45% | 3.26% | `LOSS` | -1u |
| AH | Home -0.5 | 16.4% | 22.2% | 4.5 | 4.41 | -25.99% | 2.04% | `LOSS` | -1u |
| BTTS | Yes | 50.8% | 54.0% | 1.85 | 1.85 | -5.95% | 0.00% | `WIN` | +0.85u |

### Fulham vs Liverpool (1-1) (`EPL-2020-2021-2020-12-13-fulham-liverpool`)

| Market | Selection | Model Prob | Implied Prob | Entry Odds | Close Odds | EV | CLV | Outcome | P/L (1u) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ML | Home | 8.8% | 11.1% | 9 | 8.82 | -21.11% | 2.04% | `LOSS` | -1u |
| OU25 | Over 2.5 | 78.3% | 71.4% | 1.4 | 1.36 | 9.66% | 2.94% | `LOSS` | -1u |
| AH | Home -0.5 | 8.8% | 11.1% | 9 | 8.82 | -21.11% | 2.04% | `LOSS` | -1u |
| BTTS | Yes | 61.0% | 54.0% | 1.85 | 1.85 | 12.92% | 0.00% | `WIN` | +0.85u |

### Leicester vs Brighton (3-0) (`EPL-2020-2021-2020-12-13-leicester-brighton`)

| Market | Selection | Model Prob | Implied Prob | Entry Odds | Close Odds | EV | CLV | Outcome | P/L (1u) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ML | Home | 58.3% | 50.0% | 2 | 1.96 | 16.59% | 2.04% | `WIN` | +1u |
| OU25 | Over 2.5 | 65.7% | 52.6% | 1.9 | 1.84 | 24.90% | 3.26% | `WIN` | +0.9u |
| AH | Home -0.5 | 58.3% | 50.0% | 2 | 1.96 | 16.59% | 2.04% | `WIN` | +1u |
| BTTS | Yes | 62.6% | 54.0% | 1.85 | 1.85 | 15.90% | 0.00% | `LOSS` | -1u |

### Southampton vs Sheffield United (3-0) (`EPL-2020-2021-2020-12-13-southampton-sheffield-united`)

| Market | Selection | Model Prob | Implied Prob | Entry Odds | Close Odds | EV | CLV | Outcome | P/L (1u) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ML | Home | 76.4% | 58.8% | 1.7 | 1.67 | 29.95% | 1.80% | `WIN` | +0.7u |
| OU25 | Over 2.5 | 48.4% | 49.8% | 2.01 | 1.95 | -2.67% | 3.08% | `WIN` | +1.01u |
| AH | Home -0.5 | 76.4% | 58.8% | 1.7 | 1.67 | 29.95% | 1.80% | `WIN` | +0.7u |
| BTTS | Yes | 33.0% | 54.0% | 1.85 | 1.85 | -38.96% | 0.00% | `LOSS` | -1u |

