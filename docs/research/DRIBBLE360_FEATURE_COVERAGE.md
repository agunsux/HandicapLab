# Dribble360 Elite — Feature Coverage & Missingness Report

**Generated:** 2026-10-02T20:17:33.043Z  
**Provider:** Dribble360 · **Entitlement:** Elite (trial/subscription period)  
**Transport:** REST /api/v1 (offline harvest, JSONL)  
**Audit script:** `scripts/research/dribble360/elite-warehouse-audit.mjs`  
**Leakage policy:** `feature_timestamp < kickoff (strict)`  
**Artefacts read:** `data/research/dribble360/coverage/DRIBBLE360_FEATURE_COVERAGE.json`, `data/research/dribble360/quality/DRIBBLE360_FEATURE_QUALITY.json`

> This file is **generated** by `scripts/research/dribble360/emit-coverage-report.mjs`
> from the audit artefacts. Do not hand-edit; re-run the generator. The
> narrative interpretation lives in
> `docs/providers/DRIBBLE360_SALMO_MAX_VALUE_REPORT.md`; per-feature dispositions
> live in `docs/research/DRIBBLE360_FEATURE_DECISION_MATRIX.md`.

---

## 1. Corpus Summary

| Metric | Value |
|---|---|
| `team_matches_*` records scanned | **70,651** |
| Records accepted after dedup | **70,392** |
| Duplicate `(match_id, team_id)` pairs dropped | 259 |
| Unique matches | **35,197** |
| Distinct teams | 2,839 |
| Distinct fields observed | **303** |
| Season buckets observed | 13 |

### 1.1 Harvest files

| File | Records | Size | SHA-256 (head) |
|---|---|---|---|
| `matches_2019_2020.jsonl` | **0** | 23.4 MB | `2BEAD2B8…` |
| `matches_2020_2021.jsonl` | **0** | 23.4 MB | `2BEAD2B8…` |
| `matches_2021_2022.jsonl` | **0** | 23.4 MB | `2BEAD2B8…` |
| `matches_2022_2023.jsonl` | **0** | 23.4 MB | `2BEAD2B8…` |
| `matches_2023_2024.jsonl` | **0** | 23.4 MB | `2BEAD2B8…` |
| `matches_2024_2025.jsonl` | **0** | 23.4 MB | `2BEAD2B8…` |
| `matches_2025_2026.jsonl` | **0** | 23.4 MB | `2BEAD2B8…` |
| `team_matches_2019_2020.jsonl` | **0** | 0.0 MB | `E3B0C442…` |
| `team_matches_2020_2021.jsonl` | 11,096 | 73.3 MB | `04EB346D…` |
| `team_matches_2021_2022.jsonl` | 11,861 | 78.5 MB | `25C28559…` |
| `team_matches_2022_2023.jsonl` | 11,846 | 78.4 MB | `7E16A113…` |
| `team_matches_2023_2024.jsonl` | 11,794 | 77.9 MB | `84B4B820…` |
| `team_matches_2024_2025.jsonl` | 12,138 | 80.2 MB | `DF0D1450…` |
| `team_matches_2025_2026.jsonl` | 11,916 | 78.7 MB | `1B68F57B…` |

> **Duplicate file group detected (not de-duplicated on disk).**
>
> SHA-256 `2BEAD2B87EC972049D648FB027A315E97EABAD2759A69E9C86968D8E8501E2E9` is shared byte-for-byte by **7** files:
> `matches_2019_2020.jsonl`, `matches_2020_2021.jsonl`, `matches_2021_2022.jsonl`, `matches_2022_2023.jsonl`, `matches_2023_2024.jsonl`, `matches_2024_2025.jsonl`, `matches_2025_2026.jsonl`.
> ~163.9 MB is reclaimable — only the `team_matches_*` family
> carries statistics.

> `team_matches_2019_2020.jsonl` is **0.0 MB / 0 records** — an empty harvest, not a
> zero-activity season. See the max-value report for the re-fetch follow-up.

---

## 2. Missingness — Record-Level, Not Field-Level

The headline distortion in any naive field-level read is that the gaps are not
spread across columns; whole **records** arrive without a statistics block.

Definition used: record where ALL core probe fields are null (empty statistics block).
Core probe fields: `total_sub_on`, `total_scoring_att`, `total_pass`, `accurate_pass`, `touches`.

| Measure | Records | Share |
|---|---|---|
| **No core stats at all** (empty block) | **12,178** | **17.24%** |
| All core stats present | 53,664 | 75.96% |
| Partial core stats | 4,809 | 6.81% |
| Carrying `expected_goals` | 53,250 | 75.37% |
| **Total scanned** | **70,651** | 100.00% |

### 2.1 Per file

| File | Records | No core stats | No-stats % | xG present % |
|---|---|---|---|---|
| `team_matches_2019_2020.jsonl` | **0** | 0 | — | — |
| `team_matches_2020_2021.jsonl` | 11,096 | 1,815 | 16.36% | 77.77% |
| `team_matches_2021_2022.jsonl` | 11,861 | 2,080 | 17.54% | 74.38% |
| `team_matches_2022_2023.jsonl` | 11,846 | 2,049 | 17.30% | 73.67% |
| `team_matches_2023_2024.jsonl` | 11,794 | 1,955 | 16.58% | 75.53% |
| `team_matches_2024_2025.jsonl` | 12,138 | 2,190 | 18.04% | 74.52% |
| `team_matches_2025_2026.jsonl` | 11,916 | 2,089 | 17.53% | 76.53% |

> Missingness is **tier-correlated**, not random: it concentrates in
> lower-division and cup fixtures. Within the Top-League whitelist the data is
> materially complete (§4). Consequence: select or weight by `stats-present`;
> do **not** blanket-impute.

---

## 3. Canonical Bridge — Golden ↔ Dribble

| Metric | Value |
|---|---|
| Golden records available | 8,898 |
| Dribble **side-rows** bridged | **1,158** |
| Unbridged side-rows retained as `UNBRIDGED` | 69,234 |
| Bridge rate (side-rows) | **1.65%** |
| **Unique bridged matches** | **579** |
| Method | DETERMINISTIC_SLUG_TRIPLET (date|home-slug|away-slug) — no fuzzy matching |

> **Two units, one number.** The bridge stores **one entry per match** but counts
> `bridged`/`unbridged` in **side-rows**. Hence 1,158 = 579 matches × 2 sides.
> Both figures are correct and must not be mixed.

> ⚠️ **Artefact defect, flagged not patched.** `canonicalBridge.matchedLeagues` is
> the **golden league census**, not the bridged distribution: `DEU-BUNDESLIGA: 918`, `ENG-PL: 4180`, `ESP-LALIGA: 1520`, `FRA-LIGUE1: 1140`, `ITA-SERIEA: 1140`
> — which sums to 8,898 = the golden total. Read literally it implies a
> 5-league bridge, which is **false**. The true bridged distribution, computed from
> the bridge records themselves, is **ENG-PL only, 579 matches**.

---

## 4. League × Season Coverage vs Golden

Every bridged cell is **ENG-PL**; every other harvested record is `UNBRIDGED`.
`coverageVsGoldenPct` is only defined for bridged cells.

> **The payload ships no competition identifier.** None of the 303 fields is a league,
> competition, country or season key. Competition attribution therefore exists **only**
> for the 1,158 bridged side-rows (inherited from golden `leagueId`); all
> 69,234 unbridged records are literally `UNBRIDGED` and their competition is
> **unknowable from the payload**. A full competition census for this corpus cannot be
> produced without the golden bridge, and is deliberately **not** claimed here.

| League | Season | Side-rows | Unique matches | Golden available | Missing | Coverage |
|---|---|---|---|---|---|---|
| ENG-PL | `2020-2021` | 180 | 90 | 380 | 290 | 23.68% |
| ENG-PL | `2021-2022` | 178 | 89 | 380 | 291 | 23.42% |
| ENG-PL | `2022-2023` | 180 | 90 | 380 | 290 | 23.68% |
| ENG-PL | `2023-2024` | 220 | 110 | 380 | 270 | 28.95% |
| ENG-PL | `2024-2025` | 180 | 90 | 380 | 290 | 23.68% |
| ENG-PL | `2025-2026` | 220 | 110 | 380 | 270 | 28.95% |
| UNBRIDGED | `2020_2021` | 10,892 | 5,446 | 0 | — | — |
| UNBRIDGED | `2021_2022` | 11,600 | 5,801 | 0 | — | — |
| UNBRIDGED | `2022_2023` | 11,598 | 5,799 | 0 | — | — |
| UNBRIDGED | `2023_2024` | 11,498 | 5,749 | 0 | — | — |
| UNBRIDGED | `2024_2025` | 11,772 | 5,886 | 0 | — | — |
| UNBRIDGED | `2025_2026` | 11,688 | 5,844 | 0 | — | — |
| UNBRIDGED | `unknown` | 186 | 93 | 0 | — | — |

> **Season-key format is inconsistent by construction.** Bridged cells inherit the
> golden key format (`2020-2021`, hyphen); unbridged cells inherit Dribble's
> (`2020_2021`, underscore), plus one `unknown` bucket. Normalise `-`/`_` before
> using this matrix as a join key or cells will silently miss.

### 4.1 Completeness inside bridged EPL cells

| Field | Min across bridged cells | Max across bridged cells |
|---|---|---|
| `total_scoring_att` | 100.00% | 100.00% |
| `ontarget_scoring_att` | 95.91% | 97.75% |
| `pen_area_entries` | 100.00% | 100.00% |
| `touches_in_opp_box` | 100.00% | 100.00% |
| `final_third_entries` | 100.00% | 100.00% |
| `attempts_ibox` | 99.55% | 100.00% |
| `corner_taken` | 97.75% | 99.09% |
| `total_tackle` | 100.00% | 100.00% |
| `interception` | 99.44% | 100.00% |
| `ball_recovery` | 100.00% | 100.00% |
| `accurate_pass` | 100.00% | 100.00% |
| `total_pass` | 100.00% | 100.00% |
| `accurate_cross` | 95.00% | 99.44% |
| `total_cross` | 100.00% | 100.00% |
| `goals` | 66.11% | 77.22% |
| `goals_conceded` | 66.11% | 77.22% |
| `possession_percentage` | 0.00% | 0.00% |
| `ppda` | 0.00% | 0.00% |
| `sca` | 0.00% | 0.00% |
| `gca` | 0.00% | 0.00% |
| `big_chance_created` | 70.56% | 86.82% |
| `saves` | 90.91% | 94.09% |

> `possession_percentage`, `ppda`, `sca` and `gca` are **0% in every bridged cell**
> — genuinely absent from the vendor payload, not a bridge artefact.

---

## 5. Feature Disposition

| Class | Fields | Meaning |
|---|---|---|
| `RESEARCH` | **127** | Coverage ≥ 50%, not constant, no impossibility flag |
| `LICENSE_REVIEW_LOW_COVERAGE` | 115 | Coverage < 50%; retained but gated behind licensing review |
| `NOT_AVAILABLE` | 42 | Always null across the entire corpus |
| `REJECT` | 19 | Identifiers, constants, or provably redundant values |
| **Total** | **303** | |

### 5.1 Leakage classes

| Class | Fields | Meaning |
|---|---|---|
| `PRE_MATCH_SAFE_AS_LAG` | **256** | **Current-match** value; pre-match-safe only after `shift(1)` within team |
| `POST_MATCH_ONLY` | 40 | Outcome of the predicted match — prohibited as a feature |
| `N/A` | 7 | Non-feature identifiers |

> ⚠️ **`PRE_MATCH_SAFE_AS_LAG` does not mean "known before kickoff".** Every field in
> that class is a *current-match* statistic; the provider emits nothing genuinely
> known pre-kickoff. This is the highest-risk misreading in the dataset because all
> **18 `expected_*` (xG/xA) fields** sit there. Same-match xG is a post-match
> measurement — using it unlagged is direct target leakage. Lag by ≥1 fixture per
> team. See the max-value report §5.2.

### 5.2 Highest-coverage fields

| # | Field | Coverage | Non-null | Class | Leakage |
|---|---|---|---|---|---|
| 1 | `match_id` | 100.00% | 70,392 | REJECT | N/A |
| 2 | `team_id` | 100.00% | 70,392 | REJECT | N/A |
| 3 | `side` | 100.00% | 70,392 | REJECT | N/A |
| 4 | `formation` | 100.00% | 70,392 | REJECT | N/A |
| 5 | `last_updated` | 100.00% | 70,392 | REJECT | N/A |
| 6 | `match_slug` | 100.00% | 70,392 | REJECT | N/A |
| 7 | `total_sub_on` | 82.23% | 57,886 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 8 | `total_scoring_att` | 80.77% | 56,855 | RESEARCH | POST_MATCH_ONLY |
| 9 | `touches` | 80.75% | 56,843 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 10 | `touches_in_opp_box` | 80.04% | 56,345 | RESEARCH | POST_MATCH_ONLY |
| 11 | `att_openplay` | 79.85% | 56,206 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 12 | `attempts_conceded_ibox` | 79.36% | 55,862 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 13 | `attempts_ibox` | 79.26% | 55,794 | RESEARCH | POST_MATCH_ONLY |
| 14 | `att_rf_total` | 79.16% | 55,722 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 15 | `ontarget_scoring_att` | 78.77% | 55,446 | RESEARCH | POST_MATCH_ONLY |
| 16 | `att_bx_centre` | 77.91% | 54,841 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 17 | `total_att_assist` | 77.28% | 54,400 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 18 | `successful_final_third_passes` | 77.16% | 54,314 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 19 | `total_final_third_passes` | 77.16% | 54,316 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |
| 20 | `open_play_pass` | 76.92% | 54,147 | RESEARCH | PRE_MATCH_SAFE_AS_LAG |

### 5.3 Nonzero but very sparse fields (bottom 15)

| # | Field | Coverage | Class |
|---|---|---|---|
| 1 | `six_second_violation` | 0.01% | REJECT |
| 2 | `keeper_goals` | 0.01% | REJECT |
| 3 | `rescinded_red_card` | 0.03% | REJECT |
| 4 | `back_pass` | 0.08% | REJECT |
| 5 | `att_obox_own_goal` | 0.09% | REJECT |
| 6 | `att_pen_miss` | 0.38% | REJECT |
| 7 | `att_pen_post` | 0.38% | LICENSE_REVIEW_LOW_COVERAGE |
| 8 | `att_lg_left` | 0.42% | LICENSE_REVIEW_LOW_COVERAGE |
| 9 | `att_lg_right` | 0.48% | LICENSE_REVIEW_LOW_COVERAGE |
| 10 | `att_obp_goal` | 0.57% | REJECT |
| 11 | `assist_post` | 0.63% | LICENSE_REVIEW_LOW_COVERAGE |
| 12 | `att_freekick_post` | 1.00% | LICENSE_REVIEW_LOW_COVERAGE |
| 13 | `cross_not_claimed` | 1.13% | LICENSE_REVIEW_LOW_COVERAGE |
| 14 | `assist_free_kick_won` | 1.31% | LICENSE_REVIEW_LOW_COVERAGE |
| 15 | `att_obx_right` | 1.42% | LICENSE_REVIEW_LOW_COVERAGE |

### 5.4 Zero-coverage fields (43)

```
red_cards, yellow_cards, second_yellow_cards, penalties
fk_foul_won, fk_foul_lost, possession_percentage, contentious_decision
crosses_18yard, crosses_18yardplus, first_half_goals, formation_used
own_goal_accrued, pts_dropped_winning_pos, pts_gained_losing_pos, poss_won_def_3rd
poss_won_mid_3rd, poss_won_att_3rd, shots_conc_onfield, opposition_passes
defensive_actions, ppda, direct_corner_goals, direct_setpiece_goals
expected_goals_ontarget, expected_goals_ontarget_nonpenalty, expected_goals_ontarget_freekick, expected_goals_ontarget_conceded
expected_goals_ontarget_nonpenalty_conceded, sca, gca, sca_pass_live
sca_pass_dead, sca_take_on, sca_shot, sca_fouled
sca_def, gca_pass_live, gca_pass_dead, gca_take_on
gca_shot, gca_fouled, gca_def
```

> These are `NOT_AVAILABLE`: always null across all 70,651 scanned records.
> They are **not** sparse features and must not be imputed into existence. Note
> `possession_percentage`, `ppda`, `sca`, `gca` and the whole
> `expected_goals_ontarget*` family are among them.

### 5.5 Zero-coverage reconciliation — 43 / 42 / 1

Three different numbers describe the same population. Verified against the artefacts:

| Quantity | Value | Source of truth |
|---|---|---|
| Fields at 0% coverage | **43** | `featureCoverage[*].coveragePct === 0` / `alwaysNullFields` |
| `ALWAYS_NULL` quality flags | 42 | `qualityFlagsCounts.ALWAYS_NULL` |
| `NOT_AVAILABLE` class | 42 | `classificationCounts.NOT_AVAILABLE` |

> The gap of one is **direct_setpiece_goals** — null in 70,391 of 70,651 records, with **a single non-null
> observation** (value `1`). Because it is constant it carries the `CONSTANT` quality
> flag instead of `ALWAYS_NULL`, so it is counted under `REJECT`. All three numbers
> are therefore correct and none should be quoted without its definition.

> The 8 `CONSTANT` fields — `att_obp_goal`, `att_pen_miss`, `att_obox_own_goal`,
> `back_pass`, `rescinded_red_card`, `six_second_violation`, `keeper_goals`,
> `direct_setpiece_goals` — are all rare-event counters that never fire in this
> corpus. They are **not** evidence that such events never occur.

---

## 6. Data-Quality Flags Carried Into Every Decision

| Flag | Fields | Consequence |
|---|---|---|
| `CHECK_EXTREME_MAX` | 29 | Max is an outlier requiring a per-field judgement (e.g. `touches` max = 1,307; `total_final_third_passes` max = 540). Not automatically wrong — but must be winsorised or scaled before use. |
| `SCALE_INFLATION_X11` | 1 | **Unit defect.** Observed scale is 11× the semantic unit. Carried by `goals_conceded` alone. |
| `IMPOSSIBLE_SINGLE_MATCH_VALUES` | 1 | **Unit defect.** Values that cannot occur in one match for the stated unit. Also carried by `goals_conceded` alone. |
| `CONSTANT` | 8 | Zero variance — carries no signal. Eight rare-event counters; see §5.5. |
| `ALWAYS_NULL` | 42 | Null in every record. Not a feature — classed `NOT_AVAILABLE` (see §5.5 for why this count is 42 while 43 fields sit at 0% coverage). |

> `goals_conceded` is the only field carrying **both** unit-defect flags
> (`SCALE_INFLATION_X11` *and* `IMPOSSIBLE_SINGLE_MATCH_VALUES`). Treat it as
> **unusable as stored** and re-derive from `opponent.goals ?? 0`.

> **`null` means zero for count fields** in the overwhelming majority of records
> (27,092 confirmations), with 65 documented exceptions.
> Consequence: every published count `mean` is **conditional-on-nonzero** and biased
> upward; it cannot be used as a base rate without recomputation.
> **Exception:** for xG the nulls are *missing rows*, not zeros — do not `fillna(0)`
> a frame that mixes xG and count columns.

> **`goals_conceded` is ×11** in 99.64% of admissible nonzero pairs, with a 0.36% ×1
> minority feed segment. Never divide by 11 — derive it via the scale-invariant
> mirror identity `opponent.goals ?? 0`.

> The three **gross xG aggregates** (`expected_goals`, `expected_goals_conceded`,
> `expected_assists`) are `REJECT` as **redundant**, not corrupt:
> `expected_goals ≡ expected_goals_nonpenalty + 0.7884 × penalties` and
> `expected_assists ≡ openplay + setplay`. Consume the components.

---

## 7. How To Reproduce

```bash
# 1) Full warehouse audit (offline, read-only, no network).
#    Regenerates every artefact listed below.
node scripts/research/dribble360/elite-warehouse-audit.mjs

# 2) xG decomposition / redundancy probe (offline, read-only).
node scripts/research/dribble360/d360_xg_decomp_probe.mjs \
     data/research/dribble360/harvest/team_matches_2023_2024.jsonl 20000

# 3) Re-render this report from the artefacts.
node scripts/research/dribble360/emit-coverage-report.mjs
```

Artefacts consumed (all under the gitignored `data/research/dribble360/` tree):

| Artefact | Purpose |
|---|---|
| `coverage/DRIBBLE360_FEATURE_COVERAGE.json` | Corpus summary, bridge, league×season matrix, per-feature coverage |
| `quality/DRIBBLE360_FEATURE_QUALITY.json` | ×11 proof + decomposition, missingness, alias audit, all 303 features with class |
| `canonical/DRIBBLE_MATCH_BRIDGE.json` | Per-match bridge + `UNBRIDGED` retention |
| `canonical/DRIBBLE_TEAM_MAPPING.json` | Team identity bridge |
| `manifests/WAREHOUSE_MANIFEST.json` | Corpus accounting + SHAs |

---

## 8. Governance Pointers

- **Provider role.** Dribble360 is a **research/historical** provider only. It is
  **not** a production odds authority: `OddsPAPI` remains the sole production odds
  authority and `API-Football` the fixture/statistics authority.
- **No future leakage.** Every `PRE_MATCH_SAFE_AS_LAG` field must be consumed as
  `shift(1)` within team. See §5.1.
- **No extraordinary result without audit.** Any ROI > 10%, Brier improvement
  > 10%, or unusual performance jump derived from this corpus triggers a mandatory
  leakage / target-definition / split / sample-size / methodology audit.

### 8.1 Licensing / Retention Status

> **`LICENSE_REQUIRES_REVIEW`** — retention and derivative rights are **UNVERIFIED**.
> This is the controlling blocker for every downstream use.

| Category | Status | Notes |
|---|---|---|
| Technically harvested | **YES** | 631 MB `harvest/` + 28 MB `raw_captures/`, 82 recorded Elite API calls. |
| Research-retainable | **UNVERIFIED** | No vendor retention clause has been confirmed in writing. Local research use only. |
| Commercially redistributable | **NO — not claimed** | No redistribution right is asserted or implied. Never commit the payload. |
| License unclear | **YES** | Vendor terms not reviewed by counsel. Treat as unresolved. |

> **HARD RULE — the payload must never enter git.** `.gitignore` line 127 deliberately
> excludes `data/research/dribble360/` under the comment *"NEVER commit raw provider
> captures"*, and `WAREHOUSE_MANIFEST.json` records
> `gitignoreStatus: "IGNORED … raw provider captures are never committed."` Only this
> runbook, the audit scripts and the derived reports are committed; the data itself is
> not, and the commit gate must never `git add -f` it.

> **No deployment.** Nothing derived from this corpus may enter SALMO production, and
> no research feature may be marked production-tier, until the licensing review clears.

---

*Generated end of report.*
