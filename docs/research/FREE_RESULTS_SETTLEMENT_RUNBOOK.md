# FREE RESULTS SETTLEMENT RUNBOOK — AUTOMATED & ON-DEMAND EXECUTION

**Runbook Version**: 1.0.0  
**Target Environments**: Vercel Serverless, Local Node.js, GitHub Actions CI  
**Primary Operators**: Antigravity Quantitative Research & SRE Engineering  

---

## 1. Overview & Trigger Modes

Match settlement in HandicapLab operates under strict zero-cost and zero-OddsPapi invariants.
Settlement can be executed in two modes:

1. **Automated Cron Trigger (Production)**:
   - Route: `GET /api/cron/settle` or `POST /api/cron/settle`
   - Authorization: Header `Authorization: Bearer <CRON_SECRET>`
   - Frequency: Hourly or post-gameweek window.
   - Egress Mode: Supports worker mode (`shouldDeferProviderWork`) or direct execution.

2. **Manual / CLI On-Demand Trigger**:
   - Executes settlement script using Node/TypeScript without deploying or altering code.

---

## 2. Settlement Execution Flow

```
[Cron or Operator Trigger]
           |
           v
[Authorization Check] (Bearer CRON_SECRET)
           |
           v
[Query Unsettled Past Signals] (status = 'pending' AND kickoff_utc < NOW())
           |
           v
[Group Signals by League & Season]
           |
           v
[Fetch Fixtures & Scores]
     |---> Primary: apiFootballClient.getFixtures() [Suspended / Offline]
     |---> Fallback: FreeResultsAdapter.getResultsForLeague() [Active: football-data.co.uk]
           |
           v
[Match Signal to Fixture]
     |---> Canonical Team ID Resolution (TeamRegistry)
     |---> Kickoff Window Check (|t_fixture - t_signal| <= 36 hours)
           |
           v
[Status Gate]
     |---> Is status 'FT', 'AET', or 'PEN'? (Elapsed >= 90) -> SETTLE
     |---> Is status 'CANC', 'PST', 'ABD'? -> VOID
     |---> Scheduled / In-Progress? -> SKIP (Keep Pending)
           |
           v
[Concurrency Lock] Update signal status to 'settling'
           |
           v
[Mathematical Settlement]
     |---> Asian Handicap: settleAsianHandicap(homeGoals, awayGoals, line, selection, odds)
     |---> Over/Under: settleOverUnder(homeGoals, awayGoals, line, selection, odds)
     |---> Closing Line Value: CLVCalculator.calculateDetailed()
           |
           v
[Atomic Multi-Table Persistence]
     |---> matches: home_goals, away_goals, status = 'finished'
     |---> match_results: final_score, verified_source = 'football-data.co.uk'
     |---> signals: status = won/lost/half_win/half_loss/void, profit_loss, clv
     |---> prediction_ledger: result_status, roi, verified = true
     |---> paper_trades: profit, status, bankroll_after, drawdown
     |---> signal_audit_events: SIGNAL_SETTLED event with correlation_id
           |
           v
[Recalculate Bankroll & Drawdowns] Chronological progression from starting_bankroll
           |
           v
[SALMO Contract Sync] Endpoint /api/v1/salmo/sync surfaces verified results
```

---

## 3. Mathematical Settlement Rules & Formulas

### A. Asian Handicap Settlement (`settleAsianHandicap`)
Let:
$$\Delta_{\text{adj}} = \begin{cases} 
(\text{Goals}_{\text{home}} - \text{Goals}_{\text{away}}) + \text{Line}, & \text{if selection} = \text{home} \\
(\text{Goals}_{\text{away}} - \text{Goals}_{\text{home}}) - \text{Line}, & \text{if selection} = \text{away}
\end{cases}$$

| Condition | Settlement Status | Profit Units (Stake = 1.0) |
| :--- | :--- | :--- |
| $\Delta_{\text{adj}} \ge +0.50$ | **`WON`** | $+(\text{Odds} - 1.0)$ |
| $\Delta_{\text{adj}} = +0.25$ | **`HALF_WIN`** | $+0.5 \times (\text{Odds} - 1.0)$ |
| $\Delta_{\text{adj}} = 0.00$ | **`PUSH` / `VOID`** | $0.00$ |
| $\Delta_{\text{adj}} = -0.25$ | **`HALF_LOSS`** | $-0.50$ |
| $\Delta_{\text{adj}} \le -0.50$ | **`LOST`** | $-1.00$ |

### B. Over/Under Settlement (`settleOverUnder`)
Let $T = \text{Goals}_{\text{home}} + \text{Goals}_{\text{away}}$.
Let $\Delta_{\text{adj}} = (T - \text{Line})$ for Over, or $(\text{Line} - T)$ for Under.

Quarter-lines (e.g. 2.25, 2.75) are split exactly into half-win / half-loss stakes, matching international bookmaker standards.

---

## 4. Operational Invariants & Safeguards

1. **Zero Metred API Consumption**:
   - Under NO circumstance does `FreeResultsAdapter` or `cron/settle` call OddsPapi or any metered endpoint.
   - All 250 requests of OddsPapi are preserved exclusively for pre-match pricing.
2. **Terminal Status Mandatory**:
   - Matches are NEVER settled based on elapsed time alone.
   - A fixture must have a verified terminal status code (`FT`, `AET`, `PEN`) and verified integer score fields.
3. **Protected Benchmark Immutability**:
   - The 4 historical benchmark ledgers (`live_prediction_ledger.jsonl`, `all_leagues_research_ledger.jsonl`, `multi_league_research_predictions.jsonl`) are read-only and must NEVER be modified by settlement scripts.
4. **Idempotency Guarantee**:
   - Re-running `/api/cron/settle` multiple times produces zero changes to already settled signals and zero duplicate database entries.

---

## 5. Troubleshooting & FAQs

### Q1: What if Football-Data.co.uk CSV has not updated yet?
- Football-Data.co.uk typically publishes results on Monday morning following weekend matches.
- If a match has completed on Sunday evening but is not yet in the CSV, the signal simply remains `status: 'pending'` and will settle automatically on the next scheduled cron cycle without failing or consuming quota.

### Q2: What if a match is abandoned or postponed?
- If the provider reports `'PST'`, `'CANC'`, or `'ABD'`, the signal status is updated to `'void'` and profit/loss is recorded as `0.00` (full stake returned).

### Q3: How does SALMO receive settled results?
- SALMO polls `/api/v1/salmo/sync` on HandicapLab.
- `SalmoProductionSyncService` automatically surfaces settled records in `verifiedResults` and `settledHistory` arrays with cryptographic checksum validation.
