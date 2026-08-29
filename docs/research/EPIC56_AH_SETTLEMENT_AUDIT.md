# EPIC 56 — ASIAN HANDICAP SETTLEMENT TRUTH AUDIT

**Execution Timestamp:** 2026-08-29T11:21:09.002Z  
**Status:** `VERIFIED — ZERO SETTLEMENT DISCREPANCIES`  

---

## 1. Quarter-Line Decomposition Standard

Every quarter line ($L$) is decomposed into two distinct 50% sub-stakes:
$$L_1 = L - 0.25, \quad L_2 = L + 0.25$$

Settlement resolutions:
- $\text{WIN} + \text{WIN} \to \mathbf{FULL\_WIN}$ (Payoff: $(O - 1) \times S$)
- $\text{WIN} + \text{PUSH} \to \mathbf{HALF\_WIN}$ (Payoff: $\frac{O - 1}{2} \times S$)
- $\text{PUSH} + \text{PUSH} \to \mathbf{PUSH}$ (Payoff: $0$, Stake Returned)
- $\text{LOSS} + \text{PUSH} \to \mathbf{HALF\_LOSS}$ (Payoff: $-0.5 \times S$)
- $\text{LOSS} + \text{LOSS} \to \mathbf{FULL\_LOSS}$ (Payoff: $-1.0 \times S$)
- $\text{VOID} \to \mathbf{VOID}$ (Stake Returned, Excluded from P&L Denominators)

---

## 2. 25+ Verified Historical Settlement Traces

| # | Fixture / Trace | Score | Line | Taken Odds | Quarter? | Components | Outcome | Payoff Multiplier | Net Profit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ENG-PL|2015-2016|2015-08-08|bournemouth|aston-villa` | 0-1 | -0.5 | 1.93 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 2 | `ENG-PL|2015-2016|2015-08-08|chelsea|swansea` | 2-2 | -1.5 | 2.16 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 3 | `ENG-PL|2015-2016|2015-08-08|everton|watford` | 2-2 | -1 | 2.18 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 4 | `ENG-PL|2015-2016|2015-08-08|leicester|sunderland` | 4-2 | -0.5 | 1.95 | NO | N/A | `FULL_WIN` | +0.950 | +0.950 |
| 5 | `ENG-PL|2015-2016|2015-08-08|man-united|tottenham` | 1-0 | -1 | 2.09 | NO | N/A | `PUSH` | 0.000 | 0.000 |
| 6 | `ENG-PL|2015-2016|2015-08-08|norwich|crystal-palace` | 1-3 | +0 | 1.78 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 7 | `ENG-PL|2015-2016|2015-08-09|arsenal|west-ham` | 0-2 | -1.5 | 1.89 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 8 | `ENG-PL|2015-2016|2015-08-09|newcastle|southampton` | 2-2 | +0 | 1.98 | NO | N/A | `PUSH` | 0.000 | 0.000 |
| 9 | `ENG-PL|2015-2016|2015-08-09|stoke|liverpool` | 0-1 | +0.25 | 1.95 | YES | 0, 0.5 | `FULL_LOSS` | -1.000 | -1.000 |
| 10 | `ENG-PL|2015-2016|2015-08-10|west-brom|man-city` | 0-3 | +1 | 1.74 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 11 | `ENG-PL|2015-2016|2015-08-14|aston-villa|man-united` | 0-1 | +0.75 | 1.95 | YES | 0.5, 1 | `HALF_LOSS` | -0.500 | -0.500 |
| 12 | `ENG-PL|2015-2016|2015-08-15|southampton|everton` | 0-3 | -0.5 | 1.92 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 13 | `ENG-PL|2015-2016|2015-08-15|sunderland|norwich` | 1-3 | +0 | 1.75 | NO | N/A | `FULL_LOSS` | -1.000 | -1.000 |
| 14 | `ENG-PL|2015-2016|2015-08-15|swansea|newcastle` | 2-0 | -0.5 | 1.91 | NO | N/A | `FULL_WIN` | +0.910 | +0.910 |
| 15 | `ENG-PL|2015-2016|2015-08-15|tottenham|stoke` | 2-2 | -0.75 | 1.97 | YES | -1, -0.5 | `FULL_LOSS` | -1.000 | -1.000 |
| 16 | `ENG-PL|2015-2016|2015-08-15|watford|west-brom` | 0-0 | -0.25 | 1.91 | YES | -0.5, 0 | `HALF_LOSS` | -0.500 | -0.500 |
| 17 | `ENG-PL|2015-2016|2015-08-15|west-ham|leicester` | 1-2 | -0.25 | 1.92 | YES | -0.5, 0 | `FULL_LOSS` | -1.000 | -1.000 |
| 18 | `ENG-PL|2015-2016|2015-08-16|crystal-palace|arsenal` | 1-2 | +0.75 | 1.95 | YES | 0.5, 1 | `HALF_LOSS` | -0.500 | -0.500 |
| 19 | `ENG-PL|2015-2016|2015-08-16|man-city|chelsea` | 3-0 | -0.5 | 2.06 | NO | N/A | `FULL_WIN` | +1.060 | +1.060 |
| 20 | `ENG-PL|2015-2016|2015-08-17|liverpool|bournemouth` | 1-0 | -1 | 1.72 | NO | N/A | `PUSH` | 0.000 | 0.000 |
| 21 | `ENG-PL|2015-2016|2015-08-22|crystal-palace|aston-villa` | 2-1 | -0.5 | 1.83 | NO | N/A | `FULL_WIN` | +0.830 | +0.830 |
| 22 | `ENG-PL|2015-2016|2015-08-22|leicester|tottenham` | 1-1 | +0 | 1.9 | NO | N/A | `PUSH` | 0.000 | 0.000 |
| 23 | `ENG-PL|2015-2016|2015-08-22|man-united|newcastle` | 0-0 | -1.25 | 1.87 | YES | -1.5, -1 | `FULL_LOSS` | -1.000 | -1.000 |
| 24 | `ENG-PL|2015-2016|2015-08-22|norwich|stoke` | 1-1 | -0.25 | 1.97 | YES | -0.5, 0 | `HALF_LOSS` | -0.500 | -0.500 |
| 25 | `ENG-PL|2015-2016|2015-08-22|sunderland|swansea` | 1-1 | +0.5 | 1.8 | NO | N/A | `FULL_WIN` | +0.800 | +0.800 |
| 26 | `TRACE-2-1-L-1` | 2-1 | -1 | 1.95 | NO | N/A | `PUSH` | 0.000 | 0.000 |
| 27 | `TRACE-2-1-L-0.75` | 2-1 | -0.75 | 1.95 | YES | -1, -0.5 | `HALF_WIN` | +0.475 | +0.475 |
| 28 | `TRACE-2-1-L-1.25` | 2-1 | -1.25 | 1.95 | YES | -1.5, -1 | `HALF_LOSS` | -0.500 | -0.500 |
| 29 | `TRACE-2-1-L-0.5` | 2-1 | -0.5 | 1.95 | NO | N/A | `FULL_WIN` | +0.950 | +0.950 |
| 30 | `TRACE-1-1-L-0.25` | 1-1 | -0.25 | 1.95 | YES | -0.5, 0 | `HALF_LOSS` | -0.500 | -0.500 |
| 31 | `TRACE-1-1-L0.25` | 1-1 | +0.25 | 1.95 | YES | 0, 0.5 | `HALF_WIN` | +0.475 | +0.475 |
| 32 | `TRACE-0-0-L0` | 0-0 | +0 | 1.95 | NO | N/A | `PUSH` | 0.000 | 0.000 |
| 33 | `TRACE-0-0-L0` | 0-0 | +0 | 1.95 | NO | N/A | `VOID` | 0.000 | 0.000 |
