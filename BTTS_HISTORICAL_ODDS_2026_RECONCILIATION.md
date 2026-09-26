# BTTS HISTORICAL ODDS 2026 RECONCILIATION REPORT
**Generated:** 2026-09-26T00:44:50.347Z  
**Dataset:** `data/historical/btts_historical_odds_2026.jsonl`  
**League Whitelist:** Premier League (`ENG-PL`)  
**Bookmaker Hierarchy:** **Pinnacle** (Primary Ground Truth)  

---

## 1. COVERAGE SUMMARY

| Category | Count | % of Eligible | Notes |
|---|---|---|---|
| **Eligible Fixtures (>= 2026-01-01)** | **214** | 100.0% | Finished EPL matches in cache |
| **Target Sample Ingested** | **214** | 100.0% | Evaluated in this run |
| **Canonically Mapped** | **194** | 90.7% | Resolved to `canonical_matches.jsonl` |
| **Unmapped (Future/Non-canonical)** | **20** | 9.3% | August 2026 (2026-2027 season) |
| **Ambiguous / Conflicted** | **0** | 0.0% | Zero fuzzy matching |
| **Fixtures with Real Pinnacle BTTS Odds** | **16** | 7.5% | Market 104 present with Yes/No |
| **Fixtures without BTTS Odds** | **198** | 92.5% | Early Jan 404s or unmapped |

---

## 2. BOOKMAKER & MARKET ANALYSIS

- **Primary Bookmaker:** **Pinnacle** (`bookmaker_source: 'pinnacle'`)
- **Secondary Bookmakers:** None ingested in primary dataset (zero synthetic mixing)
- **Market Classification:** **Market 104** ("Both Teams To Score")
- **Sub-period Filters:** 1st Half (10300), 2nd Half (10302), and Extra Time BTTS markets are strictly excluded.
- **Selections Extracted:** Both `YES` and `NO` required for a complete book.

---

## 3. TIMING & ANTI-LOOKAHEAD VALIDATION

- **Pre-match Invariant:** `observation_timestamp < kickoff_timestamp`
- **Pre-match Window:** `[kickoff - 14 days, kickoff]`
- **Total In-play Observations Rejected:** **1.995** data points rejected across raw feeds because their timestamp occurred after match kickoff.
- **Opening Odds Definition:** Earliest valid pre-match observation in 14-day window.
- **Closing Odds Definition:** Latest valid pre-match observation before kickoff.

---

## 4. DATA QUALITY & PROVENANCE

| Provenance Status | Count | Definition |
|---|---|---|
| **PREMATCH_VERIFIED** | **16** | Both Opening & Closing odds with valid timestamps < kickoff |
| **MISSING_OPENING** | **0** | Closing odds available, opening missing |
| **MISSING_CLOSING** | **0** | Opening odds available, closing missing |
| **UNAVAILABLE** | **198** | No Pinnacle BTTS odds found |

---

## 5. AH / OU / BTTS CANONICAL SYNCHRONIZATION

Each ingested BTTS record joins directly to the **SAME** `canonical_match_id` utilized by the Asian Handicap (AH) and Over/Under (OU) engines in `canonical_matches.jsonl`.

### Sample Canonical Join Triad:
```text
Canonical Match ID: ENG-PL|2025-2026|2026-02-01|aston-villa|brentford
├── AH Odds:   Pinnacle Line -0.25 (Home 1.88 / Away 2.03)
├── OU Odds:   Pinnacle Line 2.5   (Over 1.95 / Under 1.93)
└── BTTS Odds: Pinnacle Full Match (Yes 1.694 / No 2.26)
```

All three market views share identical team identity, season, kickoff date, and ground truth settlement!

---

## 6. SAMPLE INGESTED RECORDS

| Match | Kickoff | Opening Yes | Opening No | Closing Yes | Closing No | Closing Timestamp | Provenance |
|---|---|---|---|---|---|---|---|
| Aston Villa vs Brentford | 2026-02-01T14:00 | 1.694 | 2.23 | 1.694 | 2.26 | 2026-02-01T13:55 | `VERIFIED` |
| Man United vs Fulham | 2026-02-01T14:00 | 1.746 | 2.15 | 1.617 | 2.4 | 2026-02-01T13:56 | `VERIFIED` |
| Nott'm Forest vs Crystal Palace | 2026-02-01T14:00 | 1.854 | 2 | 1.98 | 1.892 | 2026-02-01T13:55 | `VERIFIED` |
| Tottenham vs Man City | 2026-02-01T16:30 | 1.649 | 2.31 | 1.694 | 2.25 | 2026-02-01T16:26 | `VERIFIED` |
| Sunderland vs Burnley | 2026-02-02T20:00 | 2.08 | 1.775 | 2.23 | 1.709 | 2026-02-02T19:55 | `VERIFIED` |
| Leeds vs Nott'm Forest | 2026-02-06T20:00 | 1.793 | 2.02 | 1.793 | 2.1 | 2026-02-06T19:59 | `VERIFIED` |
| Bournemouth vs Aston Villa | 2026-02-07T15:00 | 1.515 | 2.55 | 1.529 | 2.63 | 2026-02-07T14:57 | `VERIFIED` |
| Arsenal vs Sunderland | 2026-02-07T15:00 | 2.66 | 1.476 | 2.68 | 1.512 | 2026-02-07T14:55 | `VERIFIED` |
| Burnley vs West Ham | 2026-02-07T15:00 | 1.709 | 2.14 | 1.617 | 2.41 | 2026-02-07T14:58 | `VERIFIED` |
| Fulham vs Everton | 2026-02-07T15:00 | 1.943 | 1.854 | 1.787 | 2.11 | 2026-02-07T14:54 | `VERIFIED` |

---

## 7. FINAL CERTIFICATION

- [x] **Real OddsPAPI Data**: Extracted from genuine provider payloads.
- [x] **Pinnacle Exclusivity**: Primary dataset contains only Pinnacle quotes.
- [x] **Zero Synthetic Blending**: Opening and closing timestamps reflect real market state.
- [x] **Anti-Lookahead Sealed**: 100% of observations verified prior to kickoff.
- [x] **Quota Zero-Impact**: Billable request allowance completely preserved.
- [x] **Research Only**: BTTS models, EV calculations, and daily picks remain strictly unactivated.
