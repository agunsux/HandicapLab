# FOOTYSTATS CONTROLLED POST-SUBSCRIPTION VERIFICATION PLAN
### Four-Gate Empirical Forensic Protocol for FootyStats API Hobby Tier (£29.99/mo)

**Document ID:** `PLAN-FOOTYSTATS-VERIFY-v1.0`  
**Date:** September 16, 2026  
**Auditor:** Quantitative Research & Architecture Lead  
**Execution Condition:** ONLY AFTER USER EXPLICITLY AUTHORIZES & SUBSCRIBES TO 1-MONTH HOBBY TIER (£29.99)  
**Safety Status:** PRE-FLIGHT DESIGN — ZERO ACTIVE API KEYS — FAIL-CLOSED PROTOCOL

---

## 1. PURPOSE & CONTROLLED VERIFICATION PRINCIPLE

If the leadership decides to invest **£29.99 for a 1-month trial** of the FootyStats Hobby plan, the integration must **not** immediately be deployed into production or connected to the Salmo Decision OS. 

Instead, the data must pass through **four strictly gated forensic verification stages (Gates FS-0 to FS-4)**. Each gate defines mandatory automated tests and explicit Go/No-Go criteria.

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GATE FS-1     │     │   GATE FS-2     │     │   GATE FS-3     │     │   GATE FS-4     │
│ League Quota &  │ ──> │ Completeness &  │ ──> │ Odds Provenance │ ──> │ Linkage & Zero- │
│ Bulk Pagination │     │ Schema Audit    │     │ & Benchmark     │     │ Leakage Ingest  │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
   Fail: Refund            Fail: Feature           Fail: Disallow         Fail: Abort DB
    Within 24h              Store Only              CLV/Betting             Persistence
```

---

## 2. GATE FS-0: SECURITY & CREDENTIAL ISOLATION (PRE-FLIGHT)

### Objective
Ensure that the newly acquired FootyStats API key is securely isolated and never committed to Git, logged in console outputs, or exposed to the frontend.

### Protocol
1. **Local Secret Injection**:
   Store the key exclusively in local untracked `.env.local`:
   ```bash
   FOOTYSTATS_API_KEY=fs_live_xxxxxxxxxxxxxxxxxxxxxxxx
   ```
2. **Git Tracking Barrier**:
   Verify `.gitignore` prevents tracking `.env*` and generated diagnostic files:
   ```bash
   git check-ignore -v .env.local
   git ls-files | grep -i footystats
   ```
3. **Fail-Closed Client Default**:
   Update `src/services/footystats.api.ts` so that it fails closed if the key is missing or invalid:
   ```typescript
   if (!this.apiKey || this.apiKey === 'mock') {
     throw new Error('[FootyStats] Live API key required. Mock/disabled mode active.');
   }
   ```

---

## 3. GATE FS-1: LEAGUE SELECTION & BULK PAGINATION VERIFICATION

### Objective
Confirm that the Hobby account can select the top 10 target leagues and successfully retrieve full seasons in single-request bulk batches.

### Test Procedure
1. **Select Whitelisted Leagues via FootyStats Dashboard** (10 of 50 available):
   - English Premier League (`EPL`)
   - English Championship (`Championship`)
   - Spanish La Liga (`La Liga`)
   - Italian Serie A (`Serie A`)
   - German Bundesliga (`Bundesliga`)
   - French Ligue 1 (`Ligue 1`)
   - Dutch Eredivisie (`Eredivisie`)
   - Japanese J1 League (`J1`)
   - Korean K-League 1 (`K-League`)
   - Indonesian Liga 1 (`Liga 1`)
2. **Automated Diagnostic Script**: Run a controlled verification script `scripts/research/footystats_verify_fs1.ts`:
   - Call `/league-list` to verify whitelisted leagues are accessible under the account.
   - Call `/league-matches?season_id=<EPL_2023_2024>&max_per_page=500`.
3. **Assertions**:
   - HTTP status `200 OK`.
   - Payload returns exactly 380 match records in 1 HTTP response.
   - Response time $< 2,500\text{ ms}$.
   - Rate limit headers (if present) confirm 1,800 requests/hour allowance.

### Gate FS-1 Go/No-Go Criteria
- **PASS**: 10 leagues confirmed active, 380 matches returned in 1 call, zero HTTP 403/429 errors.
- **FAIL / NO-GO**: Less than 380 matches returned, pagination truncated, or account restricted. (Action: Contact FootyStats support or cancel subscription within 48-hour trial/refund window).

---

## 4. GATE FS-2: DATA COMPLETENESS & SCHEMA AUDIT

### Objective
Forensically quantify the missingness rate for match scores, physical statistics, and BTTS odds across recent seasons (2020–2024).

### Test Procedure
Run `scripts/research/footystats_verify_fs2.ts` to ingest 5 sample league-seasons (~1,900 matches) and compute field fill rates:

```typescript
interface CompletenessMetrics {
  total_matches: number;
  scores_valid_pct: number;       // homeGoalCount, awayGoalCount >= 0
  shots_valid_pct: number;        // team_a_shots, team_b_shots >= 0
  corners_valid_pct: number;      // team_a_corners, team_b_corners >= 0
  xg_valid_pct: number;           // team_a_xg, team_b_xg > 0
  odds_btts_populated_pct: number;// odds_btts_yes > 1.0 AND odds_btts_no > 1.0
  btts_zeros_count: number;       // instances where odds == 0
}
```

### Gate FS-2 Thresholds

| Metric | Minimum Required for PASS | Action if Below Threshold |
|---|---|---|
| **Scores & Results Fill Rate** | $\ge 99.8\%$ | Hard abort. Match data unreliable. |
| **Shots & Corners Fill Rate** | $\ge 95.0\%$ | Fallback to basic Poisson goal models. |
| **xG Data Fill Rate** | $\ge 80.0\%$ | Quarantine xG; do not use as core model input. |
| **BTTS Odds Population Rate** | $\ge 90.0\%$ in Top 5 Leagues | **CRITICAL**: If $< 80\%$, FootyStats cannot serve as BTTS odds store. |
| **BTTS Odds Implied Margin** | $4.0\% \le \text{Margin} \le 12.0\%$ | If margin $> 15\%$, odds are heavily juiced soft retail lines. |

---

## 5. GATE FS-3: ODDS PROVENANCE & BENCHMARK COMPARISON

### Objective
Solve the core unknown: **Whose odds are `odds_btts_yes` and `odds_btts_no`, and when were they recorded?**

### Test Procedure
1. Extract a test sample of 100 historical matches from the 2023/2024 Premier League season where HandicapLab has live OddsPapi/Pinnacle closing lines.
2. Pair FootyStats `odds_btts_yes` with OddsPapi Pinnacle closing BTTS odds for the exact same match.
3. Compute forensic alignment metrics:
   - **Pearson Correlation ($r$)**: Correlation between FootyStats BTTS odds and Pinnacle closing BTTS odds.
   - **Mean Absolute Percentage Error (MAPE)**:
     $$\text{MAPE} = \frac{1}{N} \sum_{i=1}^N \left| \frac{\text{Odds}_{\text{FS}} - \text{Odds}_{\text{Pin}}}{\text{Odds}_{\text{Pin}}} \right|$$
   - **Average Margin Spread**: Measure whether FootyStats odds systematically underpay relative to Pinnacle (indicating soft bookmaker margin).
   - **Opening vs Closing Divergence**: Check if FootyStats odds align closer to Pinnacle Opening line or Pinnacle Closing line.

### Gate FS-3 Decision Matrix
- **Scenario A ($r \ge 0.98$, $\text{MAPE} \le 1.5\%$ vs Pinnacle Closing)**:
  - **Verdict**: FootyStats reflects closing sharp consensus.
  - **Permission Granted**: Authorize use for calibration and secondary benchmark.
- **Scenario B ($r \ge 0.92$, but FootyStats margin is $3\text{--}5\%$ higher than Pinnacle)**:
  - **Verdict**: FootyStats reflects soft bookmaker closing odds (e.g. Bet365/Betfred).
  - **Permission Granted**: Authorize use for Dixon-Coles calibration and proxy evaluation; **strictly forbid** using for CLV claims without de-vigging.
- **Scenario C ($r < 0.85$ or wide arbitrary discrepancies)**:
  - **Verdict**: FootyStats odds are stale opening snapshots or synthetic composites.
  - **Permission Granted**: **HARD REJECTION FOR BETTING RESEARCH**. Use FootyStats strictly for match results and physical stats (shots/corners). All betting odds must come from OddsPapi.

---

## 6. GATE FS-4: LINKAGE & ZERO-LEAKAGE INGESTION PIPELINE

### Objective
Integrate verified FootyStats data into HandicapLab's canonical data warehouse (`wh_matches`, `wh_team_features`) without violating anti-leakage invariants or corrupting existing API-Football fixture IDs.

### Implementation Architecture
1. **Entity Resolution (`normalizeTeam`)**:
   Add FootyStats team IDs and aliases to `src/lib/warehouse/normalizer.ts`:
   ```typescript
   export function mapFootyStatsTeam(footyId: number, footyName: string): CanonicalTeamId {
     // Deterministic mapping to canonical HandicapLab team entity
   }
   ```
2. **Strict Ingestion Bifurcation**:
   Create dedicated ETL service `src/lib/warehouse/footystatsIngest.ts`:
   - Store final match results into `historical_match_facts`.
   - Store pre-match stats into `prematch_features` with explicit timestamp $T_{\text{avail}} \le T_{\text{kickoff}}$.
   - Post-match in-game metrics (shots, actual xG) are stamped with $T_{\text{avail}} = T_{\text{kickoff}} + 115\text{ min}$.
3. **Regression Validation**:
   Run the existing Asian Handicap Model A test suite:
   ```bash
   npm run research:ah:gate1
   ```
   Assert that zero AH model metrics or historical datasets are modified or regressed.

---

## 7. SUMMARY TIMELINE & BUDGET GOVERNANCE

| Phase | Duration | Cost | Prerequisite |
|---|---|---|---|
| **Phase 0: Pre-Subscription Audit (Current)** | Complete | £0 | Public Documentation |
| **Phase 1: 1-Month Hobby Trial** | Days 1–3 | £29.99 | User Approval |
| **Phase 2: Gate FS-1 & FS-2 Execution** | Days 3–5 | Included | API Key provisioned |
| **Phase 3: Gate FS-3 Odds Forensic Audit** | Days 5–7 | Included | Test script run vs OddsPapi |
| **Phase 4: Pipeline Integration (FS-4)** | Days 8–14 | Included | Gate FS-3 Conditional Pass |
| **Total Horizon** | **14 Days** | **£29.99 Max** | Fail-Closed at any gate |

