# Dribble360 Elite — SALMO Maximum-Value Report

> **Status**: AUDIT COMPLETE — research-only, offline, zero network.
> **Provider role**: research/historical only. **NOT** a production odds authority.
> **Gate**: `docs/providers/SALMO_PROVIDER_GOVERNANCE.md` (amendment 2026-10-02).
> **Audit script**: `scripts/research/dribble360/elite-warehouse-audit.mjs`
> **Audit artefacts**: `data/research/dribble360/**` (gitignored — never committable)
> **Entitlement window**: Elite access is time-boxed. This report is the retention
> decision record for what must be extracted before that access lapses.

---

## 1. Executive Summary

Dribble360 Elite was harvested into an offline warehouse of **631 MB** covering
**44,302 unique matches** (catalog) and **70,392 team-match statistics rows**
across **six seasons (2020/21 → 2025/26)**. The audit establishes five findings
that change how SALMO may use this provider.

| # | Finding | Severity | Action |
|---|---|---|---|
| **F1** | `goals_conceded` is inflated **×11** (Opta team-level event summed over 11 on-pitch players) in **99.64%** of nonzero-truth pairs; a **0.36% minority feed segment** emits the correct ×1 scale. | **BLOCKER** | Never consume the raw field. Use the scale-invariant mirror identity. |
| **F2** | **xG IS available** — but only via the **decomposed family** (`expected_goals_nonpenalty` 75.63%, `expected_goals_openplay` 75.48%, plus 6 more). The prior report's "xG unavailable / 0%" claim was **wrong**. The three **gross parent aggregates** (`expected_goals`, `_conceded`, `expected_assists`) are **REJECT** — as **redundant**, *not* corrupt: verified `expected_goals ≡ expected_goals_nonpenalty + 0.7884 × penalties` (0.7884 = a fixed vendor penalty-xG constant, residuals are exact integer multiples) and `expected_assists ≡ openplay + setplay`. | **HIGH VALUE** | Promote the decomposed xG family to P0; REJECT the gross aggregates. |
| **F3** | Canonical bridge yield is **1.65%** = **579 unique matches** (1,158 side-rows) and **entirely Premier League** (579/579). Non-EPL golden slugs (`inter`, `paris-sg`, `bayern-munich`) are abbreviated forms Dribble does not emit. | **SCOPING** | Treat as an EPL-only research asset unless a slug alias map is built. |
| **F4** | Missingness is **record-level, not field-level**: 17.24% of rows ship an **empty statistics block**; within populated rows metrics are ~complete. Top-league bridged cells show ~100%. | **MEDIUM** | Weight/select by `stats-present`, do not blanket-impute. |
| **F5** | `null` **means zero** for count fields — so every published `mean` is conditional-on-nonzero and **biased upward**. | **MEDIUM** | Reconstruct true means; never use the vendor's stated mean. |

### Net position

Dribble360 is **not** redundant with API-Football. Its unique contribution is a
**per-match xG decomposition** (open-play / set-play / right-foot / left-foot /
header / non-penalty) plus a **303-field team event ledger**. That is genuinely
additive to SALMO's OU/BTTS/AH modelling surface.

It is **not** a replacement for anything. It carries no odds, no competition or
season metadata (both endpoints return HTTP 404), and no lineup/availability data.

### Verdict

**RETAIN the decomposed xG family and the shot-quality block. QUARANTINE
`goals_conceded` (×11). REJECT the 3 gross xG aggregates. DISCARD the 42
`NOT_AVAILABLE` fields** (43 fields are always-null; one of them,
`direct_setpiece_goals`, is also a constant and is counted under REJECT). Full
per-feature disposition is in `docs/research/DRIBBLE360_FEATURE_DECISION_MATRIX.md`.

---

## 2. Corpus Inventory & Harvest Accounting

### 2.1 Harvest files

| File | Records | Notes |
|---|---|---|
| `matches_2019_2020.jsonl` … `matches_2025_2026.jsonl` (7 files) | 44,302 each | **Byte-identical clones** (identical SHA-256). 310,114 rows read, **44,302 unique**. |
| `team_matches_2019_2020.jsonl` | **0** | **EMPTY FILE — season not harvested.** |
| `team_matches_2020_2021.jsonl` | 11,096 | |
| `team_matches_2021_2022.jsonl` | 11,861 | |
| `team_matches_2022_2023.jsonl` | 11,846 | |
| `team_matches_2023_2024.jsonl` | 11,794 | |
| `team_matches_2024_2025.jsonl` | 12,138 | |
| `team_matches_2025_2026.jsonl` | 11,916 | |
| **Total** | 14 files, ~631 MB | + `raw_captures/` ~28 MB |

### 2.2 Deduplication proof

`team_matches_*` yields **70,392 accepted records** after dropping **259 duplicate
`(match_id, team_id)` pairs**, representing **35,197 unique matches** and
**2,839 distinct `team_id` values** across **303 distinct field names**.

The 7 `matches_*` files are exact duplicates of one another. If this corpus were
naively concatenated it would report **310,114 matches** — a **7× overstatement**.
The warehouse stores the verified unique count only.

### 2.3 Known gaps

| Gap | Impact | Remediable? |
|---|---|---|
| `team_matches_2019_2020` empty | EPL 2019/20 team stats absent | Only if Elite access is still live — **P0 to re-fetch** |
| No `/leagues`, `/seasons` (404) | League identity only via golden bridge | Architecturally unfixable |
| No odds endpoints (404) | OddsPAPI remains sole authority | Correct by governance |
| 3,450 side-pairs with one-sided stats | Mirror reconciliation undefined | Inherent to vendor payload |

---

## 3. Coverage & Missingness (Honest Accounting)

### 3.1 The missingness is record-level

A naive field-level reading says "shots are 80% covered". That understates the
provider badly. **17.24% of records carry no statistics at all**; among records
that *do*, the headline metrics are effectively complete.

| Measure | Value | Base |
|---|---|---|
| Records scanned | 70,651 | raw `team_matches_*` rows |
| Records with **no** core stats block | **17.24%** | of scanned |
| Records with **all** core stats | **75.96%** | of scanned |
| Records partial | 6.80% | of scanned |
| Records carrying `expected_goals` | **75.37%** | of scanned |
| Records carrying any decomposed xG variant | 63–76% | of scanned |
| Coverage in bridged top-league cells | **~100%** | of bridged |

Note the two denominators in play: **70,651 raw rows** (used by the missingness
audit) become **70,392 accepted records** after dropping 259 duplicate
`(match_id, team_id)` pairs. Percentages quoted elsewhere in this report are on
the accepted base and differ by <0.9 pt; the table above uses the raw base for
consistency with `DRIBBLE360_FEATURE_QUALITY.json`.

**Consequence**: missingness is **tier-correlated**, not random. It concentrates
in lower-division / cup fixtures. For the modelled Top-League whitelist the data
is materially complete.

### 3.2 Canonical bridge yield

| Metric | Value |
|---|---|
| Golden records available | 8,898 (5 leagues) |
| Dribble **side-rows** bridged | **1,158** (1.65% of 70,392) |
| **Unique bridged matches** | **579** |
| Unbridged side-rows retained as `UNBRIDGED` | 69,234 |
| Bridge rate | **1.65%** |
| **Leagues bridged (verified from the bridge records)** | **ENG-PL only — 579/579** |
| Method | **Deterministic slug triplet** `date \| home-slug \| away-slug`, no fuzzy matching (100% `SLUG_TRIPLET_EXACT`) |
| Coverage vs golden (EPL, per season) | 90/380 … 110/380 (**23.4% – 29.0%**) |

> **Two units, one number.** `DRIBBLE_MATCH_BRIDGE.json` stores one entry per
> **match** (35,197 entries) but counts `bridged`/`unbridged` in **side-rows**
> (70,392). Hence `bridged = 1,158 = 579 matches × 2 sides`. Both figures are
> correct; they must not be mixed.

> **Artefact defect (flagged, not silently corrected).** The companion field
> `canonicalBridge.matchedLeagues` in `DRIBBLE360_FEATURE_COVERAGE.json` reads
> `{DEU-BUNDESLIGA: 918, ENG-PL: 4180, ESP-LALIGA: 1520, FRA-LIGUE1: 1140,
> ITA-SERIEA: 1140}` — that sums to 8,898, i.e. it is the **golden league
> census**, not the bridged distribution. Read literally it implies a 5-league
> bridge, which is **false**. The true bridged distribution, computed from the
> bridge records themselves, is **ENG-PL 579 and nothing else**.

The 1.65% is **legitimate and fully explained**, not an artefact:

1. Golden league slugs are abbreviated where Dribble's are not (`man-city`,
   `inter`, `paris-sg`, `dortmund` vs Dribble's full slugs) → non-EPL leagues
   cannot bridge without an alias map.
2. Cup fixtures collide with league dates and are correctly refused.
3. Golden covers 5 leagues / 24 league-seasons vs Dribble's 2,839 team slugs.
4. Unmatched records are **retained as `UNBRIDGED`, never discarded** — the audit
   is lossless by construction.

> A prior-session index (`data/research/dribble360/canonical_mapping_index.json`)
> reports 2,090 entries, also **ENG-PL only**. The two agree in scope; this audit
> is stricter because it refuses fuzzy matches and cup-date collisions.

### 3.3 Bridged cell completeness

Every bridged EPL cell shows `total_scoring_att` 100%, `pen_area_entries` 100%,
`accurate_pass` 100%, `ontarget_scoring_att` 95.9–97.8%. `possession_percentage`
and `ppda` are **0% in every cell**. This is the empirical basis for declaring the
bridged EPL subset fully usable for feature engineering.

---

## 4. Headline Defect F1 — `goals_conceded` ×11

### 4.1 Proof

Mirror identity: goals scored by AWAY == goals conceded by HOME. Every side-pair
is tested for `conceded_raw == opponent_goals × k`:

| Test | Result |
|---|---|
| Side-pairs tested | **70,390** |
| — truth = 0 (degenerate: ×1 and ×11 indistinguishable) | 27,092 |
| — **admissible nonzero-truth pairs** | **39,848** |
| — of which reconcile **exactly at ×11** | **39,703 → 99.64%** |
| — of which reconcile **exactly at ×1** | **145 → 0.36%** |
| — of which match **any other scale** | **0** |
| Pairs not reconcilable at all | 3,450 (4.90% of all pairs) |
| Median observed ratio (nonzero pairs) | **11** |
| `null`-means-zero confirmations | **27,092** |

Two findings replace the previous single-number claim:

**(a) The ×11 defect is confirmed and dominant**, but not uniform. Among nonzero
pairs the field is either exactly ×11 (99.64%) or exactly ×1 (0.36%) — never any
other scale. The 145 ×1 pairs form a **distinct minority feed segment**,
observed in French domestic cup fixtures (Coupe de France, Feb-2021 batch). Raw
values in that segment are small and correct (1→39, 2→53, 3→32, 4→11, 5→6, 6→2,
7→2 pairs).

> **This means a blanket "divide by 11" correction would be WRONG.** The only
> safe derivation is the **scale-invariant mirror identity** (§4.5).

**(b) The 3,450 non-reconcilable pairs are undefined, not contradictory.** They
occur in matches where **exactly one side ships an empty statistics block**, so
the mirror value does not exist. They cannot falsify the ×11 hypothesis.

> **Reconciling the two "failure" counts.** The artefact also publishes
> `pairsFailed = 3,595` and `exactX11Pct = 94.89%` (over *all* 70,390 pairs).
> These are not in conflict — they decompose exactly:
>
> `3,595 = 145 (the ×1 minority segment) + 3,450 (not reconcilable)`
>
> `pairsFailed` counts "not exactly ×11" over all pairs; `notReconcilable` counts
> "no scale at all applies". Always state which one is meant.

### 4.2 Root cause

Majority Opta-derived aggregations attribute the team-level "goals conceded"
event to each of the 11 on-pitch players; the vendor's `team_matches` endpoint
**SUM**s that event rather than taking one instance. Hence
`conceded_raw = true_team_goals_conceded × 11`.

### 4.3 `null` means zero — with 48 documented exceptions

`null` overwhelmingly encodes zero: **27,092 confirmations** against **65 flags**.
Those 65 split into:

- **17 one-sided flags** — the mirror side has no stats block, so its own `goals`
  is null while the populated side legitimately records a nonzero conceded. An
  attribution artefact, not a counter-example.
- **48 two-sided flags** — **both** sides carry stats, yet the scoring side's
  `goals` is null while the mirror side records `conceded_raw = 11k` (k > 0).
  These are genuine **score-reconciliation conflicts**, concentrated in UEFA
  Champions/Europa/Conference League **qualifying rounds** (extra time / penalty
  deciders) plus a handful of lower-division cup ties.

**Consequence**: `conceded = opponent.goals ?? 0` is correct for 99.86% of
matches but silently yields 0 for the 48 flagged fixtures. Those 48 must be
either excluded or resolved via `round(conceded_raw / 11)` after review. They are
listed in the audit artefact for manual triage.

### 4.4 Reaches consumption

`src/lib/research/dribble/dribbleMultiWindowFeatureLab.ts` **L213–215** and
**L235** sum the raw field into `avg_goals_conceded`. Any consumer of that
feature is fed values 11× too large. This is reported, **not silently patched** —
see §8 for the remediation decision.

### 4.5 Remediation (mandatory)

The mirror identity is **scale-invariant**, which is exactly why it is the only
safe derivation — it handles both the ×11 majority and the ×1 minority segment
identically:

```
true_conceded = opponent.goals ?? 0          # primary, scale-invariant
```

With the documented caveat for the 48 score-reconciliation conflicts:

```
if (bothSidesHaveStats && opponent.goals === null && conceded_raw > 0)
    true_conceded = round(conceded_raw / 11)   # ONLY after manual review; flag the match
```

`goals_conceded` and the derived `clean_sheet` are **REJECT** class. They must
not enter any model, feature store, or calibration target — and note that a
"divide by 11" pre-processing step would corrupt the 145 correct-scale rows.


---

## 5. Headline Finding F2 — xG **IS** Available

A prior report concluded Dribble360 provides no usable xG. **That conclusion was
wrong.** It was based on the bare `expected_goals` field path and missed the
decomposed variants. But the correction cuts both ways: the **decomposed** family
is usable, the **gross aggregates** are not.

| Field family | Coverage | Verdict |
|---|---|---|
| `expected_goals_nonpenalty` / `_conceded` | **75.63%** | **P0 RESEARCH** |
| `expected_goals_openplay` | 75.48% | **P0 RESEARCH** |
| `expected_goals_rf` / `expected_goals_lf` | 74.99% / 72.19% | RESEARCH |
| `expected_goals_setplay` | 69.96% | RESEARCH |
| `expected_goals_hd` (header) | 63.52% | RESEARCH |
| `expected_assists_openplay` / `_setplay` | 75.68% / 75.67% | RESEARCH |
| `expected_goals_freekick` | 26.13% | LICENSE_REVIEW_LOW_COVERAGE |
| `expected_goals` / `expected_goals_conceded` | 75.64% | **REJECT — redundant: `= nonpenalty + 0.7884 × penalties`** |
| `expected_assists` | 75.68% | **REJECT — redundant: `= openplay + setplay`** |
| `expected_goals_ontarget` (+4 variants) | **0%** | **NOT_AVAILABLE** |

### 5.1 Why the gross aggregates are REJECT — **redundancy, not corruption**

> ⚠️ **Correction to an earlier draft of this report.** A first pass described
> `expected_goals` as *"internally impossible / contradicts its own decomposition
> in 36% of rows."* A dedicated re-probe (`scripts/research/dribble360/
> d360_xg_decomp_probe.mjs`, read-only, offline, 8,908 admissible rows of
> `team_matches_2023_2024.jsonl`) **disproves** that framing. The earlier number
> was an artifact of comparing the gross total against a decomposition that
> **omits penalty xG**. The corrected model is below; the REJECT verdict is
> retained, for a different and better-evidenced reason.

**Verified model: `expected_goals` is affine in a count field.**

| Component of `expected_goals` | Share of admissible rows | Evidence |
|---|---|---|
| penalty-xG residual **exactly 0** | **85.02%** | `gross − nonpenalty ≤ 5e-5` |
| residual **= 0.7884** (1 penalty) | 1,221 rows | exact |
| residual **= 1.5768** (2 × 0.7884) | 108 rows | exact |
| residual **= 2.3652** (3 × 0.7884) | 5 rows | exact |
| residual **not** an integer multiple of 0.7884 | **0 rows** | — |

So `expected_goals = expected_goals_nonpenalty + 0.7884 × k`, where **0.7884 is a
fixed vendor penalty-xG constant** and `k ∈ {0,1,2,3}` is the number of penalties
awarded. This also **exactly explains** the earlier draft's numbers: the compound
statistic `gross − (openplay + setplay)` is zero only when BOTH `k = 0` (85% of
rows) AND `nonpenalty == openplay + setplay` (75% of rows) → predicted
`0.85 × 0.75 ≈ 64%`, and the observed value was **64.25%**; the "500 negatives"
are precisely the `k = 0` rows carrying the small `nonpenalty ≠ openplay+setplay`
residual. **Nothing is impossible. The gross column is simply redundant.**

Full probe results:

| Identity tested | n | exact | negatives | mean Δ | max \|Δ\| |
|---|---|---|---|---|---|
| `expected_assists` vs `openplay + setplay` (raw) | 8,908 | 55.99% | 2,024 | 3e-06 | 1.5e-04 |
| `expected_assists` vs `openplay + setplay` (**rounded to 4 dp**) | 8,908 | **96.77%** | 81 | 3e-06 | **2.0e-04** |
| `expected_goals_nonpenalty` vs `openplay + setplay` | 8,211 | 75.07% | 1,053 | 2.7e-05 | 0.0179 |
| `expected_goals_nonpenalty` vs `openplay + setplay + freekick` | 3,033 | **0.00%** | **3,033** | 0.0711 | 0.3321 |
| `penalty-xG residual ≥ 0` | 8,908 | 85.02% (=0) | **0** | 0.1285 | 2.3652 |

*Interpreting these:*

1. **`expected_assists` is pure redundancy.** Raw comparison looks weak (56%)
   only because the vendor rounds each of the three columns **independently to 4
   decimal places**. Round both sides to the vendor's own 4-dp grid and the
   identity holds in **96.77%** of rows with a maximum residual of `2.0e-04`.
   It carries **zero** information beyond its two components → REJECT as a
   duplicate is correct.
2. **`expected_goals` is redundancy too** — it is `nonpenalty` plus a
   constant × a penalty count. Consuming both the gross total *and* its parts
   injects perfect collinearity while losing the open-play/set-piece split, which
   is the analytically interesting signal. Reconstruct the gross figure when you
   need it; **do not store it as an independent feature**.
3. **`expected_goals_freekick` is a SUBSET of `expected_goals_setplay`.** Adding
   it to `openplay + setplay` over-counts in **100% of rows** (3,033/3,033, mean
   `+0.0711`, max `+0.3321`). Free-kick xG is already inside set-play. Do **not**
   sum `openplay + setplay + freekick`.
4. **`expected_goals_nonpenalty` vs `openplay + setplay` is a near-identity with a
   real, unexplained residual** (24.9% of rows, up to `0.0179`) — ≈130× larger
   than the 4-dp rounding floor, and rounding the operands does not close it. This
   is a **minor vendor inconsistency** and is logged as a follow-up (§11.3); it
   does not affect the REJECT verdict but it does mean *do not* treat
   `nonpenalty` and `openplay + setplay` as interchangeable.
5. **The one strictly-holding invariant** is `expected_goals ≥ expected_goals_nonpenalty`:
   **0 negative residuals in 8,908 rows**, which is why the penalty share is
   cleanly recoverable.

### 5.2 ⚠️ Leakage hazard — xG is a *current-match* statistic

The quality artefact classes all **18 `expected_*` fields** — including the P0
`expected_goals_nonpenalty` — as `PRE_MATCH_SAFE_AS_LAG`. **That label does not
mean "known before kickoff".** It means the raw value is a *current-match*
statistic that becomes a legal feature only after `shift(1)` within team. Every
one of the 256 fields in that class is a current-match statistic; **this provider
emits nothing that is genuinely known pre-kickoff.**

Same-match xG is a post-match *measurement* of the match being predicted. Wiring
it in unlagged is direct target leakage and would manufacture an extraordinary,
non-reproducible "edge" — exactly the scenario the research invariants require an
automatic audit for. Any SALMO integration must lag xG by at least one fixture
per team (rolling mean of *prior* matches only). Tracked as **P0 follow-up #12**.

### 5.2 Why this matters to SALMO

xG is the primary explanatory variable for **Over/Under** and **BTTS** pricing. A
per-match xG decomposition that separates open-play from set-play and right-foot
from left-foot gives the model **process-level signal** rather than just outcome
counts. That is exactly what the product philosophy's explainability requirement
demands (a prediction must show *why* — xG indicators, ELO shifts, home
advantage — not just a black-box percentage).

**Plausibility checks passed**: non-penalty xG mean 1.2770 sits below gross 1.4068
(penalty share ≈ 0.13 — realistic); gross xG mean 1.4068 per team-match is
realistic; and `expected_goals` ≡ `expected_goals_conceded` corpus-wide confirms
the HOME↔AWAY mirror symmetry holds.

---

## 6. Harvest Inventory — P0 → P3 Retention Tiers

Prioritised by (a) unique value, (b) difficulty of re-derivation, (c) governance risk.

### P0 — Retain first (unique, hard to re-derive, highest model value)

| Block | Fields | Coverage |
|---|---|---|
| **xG decomposition** | `expected_goals_nonpenalty`, `expected_goals_nonpenalty_conceded`, `expected_goals_openplay`, `expected_goals_setplay`, `expected_goals_rf`, `expected_goals_lf`, `expected_goals_hd`, `expected_assists_openplay`, `expected_assists_setplay` — **excludes** the 3 REJECT gross aggregates (`expected_goals`, `expected_goals_conceded`, `expected_assists`) | 63–76% |
| **Shot quality/volume** | `total_scoring_att`, `ontarget_scoring_att`, `shot_off_target`, `blocked_scoring_att`, `att_ibox_target`, `att_ibox_miss`, `att_ibox_blocked`, `att_ibox_goal`, `att_rf_target`, `att_obox_miss`, `att_hd_total`, `pen_area_entries` | 56–80% |
| **Chance quality** | `big_chance_created`, `big_chance_missed`, `saves`, `diving_save`, `saved_ibox` | 54–70% |

### P1 — Retain (strong supporting signal, partly recoverable elsewhere)

| Block | Fields | Coverage |
|---|---|---|
| Territory / volume | `touches`, `touches_in_opp_box`, `total_pass`, `accurate_pass`, `total_final_third_passes`, `final_third_entries`, `total_cross`, `accurate_cross`, `corner_taken`, `won_corners`, `total_corners_intobox` | 72–81% |
| Duels / defence | `duel_won`, `duel_lost`, `aerial_won`, `aerial_lost`, `total_tackle`, `won_tackle`, `interception`, `total_clearance`, `ball_recovery` | 74–76% |
| Distribution style | `total_long_balls`, `accurate_long_balls`, `long_pass_own_to_opp`, `goal_kicks`, `total_launches`, `total_throws`, `total_flick_on` | 69–76% |

### P2 — Retain as metadata / low priority

`goals` (usable), `total_yellow_card`, `total_offside`, `offside_provoked`,
`total_sub_on`, `subs_made`, `turnover`, `dispossessed`, `overrun`.

### P3 — Reject / metadata only

Identifiers (`match_id`, `team_id`, `side`, `match_slug`), labels (`formation`,
`formation_used`, `last_updated`), the ×11-defective `goals_conceded`, the 8
constant fields, and the 42 always-null fields.

### Discard outright

The **42 `NOT_AVAILABLE` fields** — all always-null — carry zero information and
should be dropped at ingest so they never silently enter feature pipelines.
(43 fields are flagged always-null; `direct_setpiece_goals` is both always-null
and constant, so it is counted once, under `REJECT`.)


---

## 7. Additional Data-Quality Findings

### 7.1 Seven suspected column aliases

Deterministically detected as fields sharing *identical* `(nonNullCount, min,
max, mean)` over the whole corpus — i.e. the same column exported twice:

| Group |
|---|
| `poss_lost_all` ≡ `poss_lost_ctrl` |
| `total_clearance` ≡ `effective_clearance` |
| `turnover` ≡ `unsuccessful_touch` |
| `interception` ≡ `interception_won` |
| `head_clearance` ≡ `effective_head_clearance` |
| `blocked_cross` ≡ `effective_blocked_cross` |
| `att_fastbreak` ≡ `shot_fastbreak` |

Collapse each to one feature. Consuming them as independent features injects
perfect collinearity and inflates the apparent feature count by 7.

Home/away mirror pairs (`duel_won`/`duel_lost`, `expected_goals`/`expected_goals_conceded`)
are **not** aliases — they are a data-validity signal and are retained. The
artefact's `columnAliasAudit.mirrorPairsValidated` array is currently **empty**:
no alias group was found that is *also* a mirror pair, which is the expected
(result-checks-out) outcome. The `expected_goals`/`_conceded` identity is
verified separately, corpus-wide, on identical `(nonNullCount, min, max, mean)`.

### 7.2 Eight constant fields

`att_obp_goal` · `att_pen_miss` · `att_obox_own_goal` · `back_pass` ·
`rescinded_red_card` · `six_second_violation` · `keeper_goals` ·
`direct_setpiece_goals` — zero variance, `REJECT`.

### 7.3 Inconsistent zero-encoding

Count fields overwhelmingly encode zero as `null` (hence `min = 1`), but at least
one field, `fouled_final_third`, exposes explicit `min = 0`. The vendor's
zero-encoding is **not uniform per field**, so any ingestion code must handle
both representations rather than assuming one.

### 7.4 Team identity bridge is very weak

Only **86 of 2,839** provider team ids (**3.03%**) resolve to a canonical team.
This is the same abbreviation-divergence problem that caps the match bridge at
1.65% (report §3.2). **Any team-level join must therefore be built on the match
bridge, not on team identity.**

---

### 7.5 Coverage-matrix season keys are inconsistent

`coverageMatrix` mixes season key formats: `2020-2021` **and** `2020_2021` both
appear, alongside an `unknown` bucket, producing 13 cells for 6 seasons
(6 `ENG-PL` + 7 `UNBRIDGED`). Downstream consumers must normalise
`-`/`_` before using this matrix as a join key, or cells will silently
double-count/miss.

---

## 8. Remediation Decision — The ×11 Consumer Bug

The defect reaches a live consumer:
`src/lib/research/dribble/dribbleMultiWindowFeatureLab.ts` **L213–215** and
**L235** sum the raw `goals_conceded` field into `avg_goals_conceded`.

| Question | Assessment |
|---|---|
| Is it production? | **No** — `src/lib/research/**` is research-only. |
| Does it affect SALMO production behaviour? | **No.** Not wired into the daily pipeline or prediction engine. |
| Does it corrupt a research dataset? | **Yes** — any `avg_goals_conceded` produced to date is 11× too large. |
| Scope of this sprint | Harvest + audit only. |

**Decision**: **report, do not silently patch.** The corrective change is a
one-line derivation swap (`opponent.goals ?? 0`) and carries its own required
unit + regression test. It is recorded here as a **P0 follow-up** with the exact
file, line numbers, and required semantics, so it can be actioned and verified
independently rather than bundled invisibly into a research-harvest commit.

**Interim instruction**: no downstream consumer may read `goals_conceded`,
`clean_sheet`, or `avg_goals_conceded` from this warehouse until the fix lands.


---

## 9. Market-Relevance Triage — AH / OU / BTTS

> **Important honesty note.** This audit measured **coverage, scale validity, and
> internal consistency**. It did **not** fit a model, so it **cannot** claim a
> positive predictive edge for any feature. The rankings below are a
> **domain-prior + coverage-based shortlist for the first backtest**, not a
> validated result. Per the research invariants, any ROI or Brier improvement
> that emerges later must trigger a leakage/definition audit before it is
> believed.

### 9.1 Over/Under (total goals) — highest-priority block

| Rank | Feature | Coverage | Rationale |
|---|---|---|---|
| 1 | `expected_goals_nonpenalty` | 75.6% | Direct goal-expectation; the canonical OU driver |
| 2 | `expected_goals_nonpenalty_conceded` | 75.6% | Opponent-side goal expectation; closes the two-sided picture |
| 3 | `total_scoring_att` | 80.8% | Highest-coverage volume proxy |
| 4 | `ontarget_scoring_att` | 78.8% | Shot quality filter over volume |
| 5 | `big_chance_created` | 56.2% | Best available chance-quality marker |
| 6 | `touches_in_opp_box` | 80.0% | Territory pressure |
| 7 | `pen_area_entries` | 76.1% | Sustained attacking possession |
| 8 | `expected_goals_openplay` | 75.5% | Separates repeatable open-play process |
| 9 | `saves` / `diving_save` | 70.3% / 54.5% | Opponent shot-stopping load |
| 10 | `shot_off_target` + `blocked_scoring_att` | 75.4% / 70.5% | Wasted-volume correction |

### 9.2 Asian Handicap (margin / dominance)

| Rank | Feature | Coverage | Rationale |
|---|---|---|---|
| 1 | `expected_goals_nonpenalty` − `expected_goals_nonpenalty_conceded` | 75.6% | The xG differential — dominant AH regressor |
| 2 | `total_scoring_att` − `attempts_conceded_*` | 79–80% | Shot dominance differential |
| 3 | `ontarget_scoring_att` differential | 78.8% | Quality-weighted dominance |
| 4 | `big_chance_created` differential | 56.2% | Chance-quality asymmetry |
| 5 | `pen_area_entries` differential | 76.1% | Field-territory edge |
| 6 | `touches_in_opp_box` differential | 80.0% | Box presence asymmetry |
| 7 | `duel_won` / `aerial_won` | 76.1% / 75.2% | Physical dominance proxy |
| 8 | `total_final_third_passes` | 77.2% | Penetration capability |
| 9 | `attempts_ibox` | 79.3% | High-value chance volume |
| 10 | `saved_ibox` (opponent) | 62.1% | Goalkeeper suppression effect |

### 9.3 Both Teams To Score (BTTS)

BTTS is inherently **two-sided**: it requires each side's *attack* against the
other's *defence*. Every feature below must be joined from **both** the HOME and
AWAY rows of the same `match_id`.

| Rank | Feature (per side, then joined) | Coverage | Rationale |
|---|---|---|---|
| 1 | `expected_goals_nonpenalty` (both sides) | 75.6% | Marginal scoring expectation per team |
| 2 | `expected_goals_nonpenalty_conceded` (both sides) | 75.6% | Defensive softness faced by each side |
| 3 | `ontarget_scoring_att` (both sides) | 78.8% | "Will they actually carve a goal" filter |
| 4 | `big_chance_created` (both sides) | 56.2% | Clean-cut chance production |
| 5 | `saves` / `saved_ibox` (both sides) | 70.3% / 62.1% | Goalkeeper suppression — the BTTS dampener |
| 6 | `pen_area_entries` (both sides) | 76.1% | Penalty-area access |
| 7 | `total_scoring_att` (both sides) | 80.8% | Highest-coverage volume base |
| 8 | `expected_goals_setplay` (both sides) | 70.0% | Set-piece route (BTTS often breaks via dead balls) |
| 9 | `shot_off_target` (both sides) | 75.4% | Conversion-efficiency correction |
| 10 | `expected_goals_hd` (both sides) | 63.5% | Aerial route to goal |

### 9.4 What is *missing* for these markets

Neither AH, OU nor BTTS can be modelled on **possession** or **pressing**
(`possession_percentage`, `ppda`, `defensive_actions` are all null). Possession
must be **approximated** from pass-volume shares (`total_pass`,
`accurate_pass`) and cross/territory counts. This is an acknowledged modelling
limitation, not a data error.


---

## 10. Governance, Licensing & Entitlement Constraints

### 10.1 Provider role (binding)

Per `docs/providers/SALMO_PROVIDER_GOVERNANCE.md` (amendment 2026-10-02):

- **`OddsPAPI` remains the sole production odds authority.** Dribble360 exposes
  **no odds endpoints** (`/odds`, `/bookmakers`, `/markets` → HTTP 404), so it
  cannot and must not be treated as an odds source.
- **Dribble360 is a research/historical provider only** (offline, non-production).
- No provider may be promoted to production authority without explicit
  architecture approval. **This audit does not request or imply such promotion.**
- `5DollarFootballAPI` remains a separate research-only provider; its artefacts
  are untouched by this work.

### 10.2 Single Source of Truth

For fixtures/statistics the SSOT remains **API-Football**. Dribble360 data is
**supplementary research enrichment**, not a replacement. Where the two
disagree, API-Football wins for production, and the disagreement is logged as a
research finding.

### 10.3 Bookmaker hierarchy

Unchanged. **Pinnacle** remains the CLV ground truth; SBOBET is a secondary
comparator. Dribble360 plays no role in either.

### 10.4 Licensing / retention — OPEN, BLOCKING

**This audit deliberately does not assert retention rights it cannot evidence.**

| Item | Status |
|---|---|
| Entitlement tier | Elite (time-boxed trial/subscription) |
| Stated rate limit | 5,000 requests/day (Elite) |
| BigQuery access | **Not available** |
| Redistribution rights | **UNVERIFIED** — requires vendor ToS review |
| Derivative-model rights | **UNVERIFIED** — requires vendor ToS review |
| Retention after access expiry | **UNVERIFIED** |
| Permitted internal-research use | **UNVERIFIED** |

**Required action before this corpus informs any shipped model**: obtain written
confirmation of (a) derivative-work rights, (b) internal retention rights, and
(c) whether derived features may be served to end users. Until then the corpus is
treated as **internal-research-only and non-servable**, and it lives exclusively
in the gitignored `data/research/dribble360/**` namespace.

### 10.5 Storage & leak discipline

- `data/research/dribble360/**` is **gitignored** — verified. Raw provider
  captures are therefore **never committable**.
- The audit is **read-only**: zero network calls, no writes outside the
  gitignored research namespace, no touches to `data/golden/**`, Supabase, or
  `.env*`.
- The audit script is `.mjs`, and `tsconfig` includes only `**/*.ts`, so it
  carries **zero `tsc` risk**.

---

## 11. Audit Artefact Index & Follow-Ups

### 11.1 Artefacts produced (gitignored namespace, verified on disk)

| Artefact | Purpose |
|---|---|
| `coverage/DRIBBLE360_FEATURE_COVERAGE.json` | Corpus summary, canonical bridge, 13-cell league×season matrix, per-feature coverage |
| `quality/DRIBBLE360_FEATURE_QUALITY.json` | ×11 proof + decomposition, missingness structure, alias audit, all **303** features with `decision` / `leakageClass` / `qualityFlags` |
| `canonical/DRIBBLE_MATCH_BRIDGE.json` | 35,197 per-match entries (579 bridged, 34,618 `UNBRIDGED`); `bridged`/`unbridged` scalars are side-rows (1,158 / 69,234) |
| `canonical/DRIBBLE_TEAM_MAPPING.json` | Team identity bridge — 86 mapped / 2,753 unmapped of 2,839 |
| `manifests/WAREHOUSE_MANIFEST.json` | Corpus accounting + SHAs |
| `raw/SOURCE_MANIFEST.json` | Raw capture provenance |
| `schemas/schema_registry.json` | Observed schema registry |
| `harvest/team_matches_*.jsonl` | The actual harvested corpus (~631 MB) |
| `harvest/matches_*.jsonl` | 7 byte-identical clones (see §2.1) |
| `raw_captures/*.json` | Non-`team_matches` endpoint probes (odds/leagues/seasons → mostly empty; 404 evidence) |

> The human-readable coverage report is deliberately **not** written into this
> namespace, because that namespace is gitignored and would not survive a fresh
> clone or the lapse of Elite access. It is committed instead at
> `docs/research/DRIBBLE360_FEATURE_COVERAGE.md` (see §11.2).

### 11.2 Committed artefacts (this sprint)

| Artefact | Purpose |
|---|---|
| `scripts/research/dribble360/elite-warehouse-audit.mjs` | The reproducible audit |
| `docs/providers/DRIBBLE360_SALMO_MAX_VALUE_REPORT.md` | This report |
| `docs/research/DRIBBLE360_FEATURE_DECISION_MATRIX.md` | Per-feature disposition |
| `docs/research/DRIBBLE360_FEATURE_COVERAGE.md` | Human-readable coverage / missingness report |

### 11.3 Follow-ups (not actioned in this sprint)

| # | Item | Priority |
|---|---|---|
| 1 | Fix `avg_goals_conceded` ×11 consumption in `dribbleMultiWindowFeatureLab.ts` L213–215, L235 + unit/regression test | **P0** |
| 2 | Re-fetch `team_matches_2019_2020` (currently an empty file) while Elite access is live | **P0** |
| 3 | Vendor ToS review for retention / derivative / serving rights (§10.4) | **P0 (blocking)** |
| 4 | Build a slug alias map to extend the bridge beyond ENG-PL | P1 |
| 5 | Collapse the 7 alias groups before modelling | P1 |
| 6 | Resolve / exclude the 48 score-reconciliation conflicts | P1 |
| 7 | `config/league_registry.json` is **invalid JSON** and `identifyLeague()` uses non-deterministic regex guessing — unrelated to this provider but observed during the audit | P1 |
| 8 | Deduplicate the 7 byte-identical `matches_*.jsonl` files to reclaim ~540 MB | P2 |
| 9 | Harden ingest contract: drop the 3 REJECT gross xG aggregates, the 42 `NOT_AVAILABLE` fields, and the 8 constants at load time | P1 |
| 10 | Fix artefact defects: `canonicalBridge.matchedLeagues` is the golden census (not bridged); `coverageMatrix` mixes `-`/`_` season keys + `unknown`; `DRIBBLE_MATCH_BRIDGE.json` mixes per-match array with side-row scalars | P2 |
| 11 | Extend the audit to assert the ×11 rule as a **regression test** so a future re-harvest cannot silently reintroduce it | P1 |
| 12 | **Leakage guard for xG**: every `expected_*` field is a *current-match* statistic mislabelled `PRE_MATCH_SAFE_AS_LAG`. Enforce `shift(1)`-within-team lag at the feature-store boundary, or better, ensure no `expected_*` column can be read unlagged | **P0** |
| 13 | Document/verify the `0.7884` penalty-xG constant against `penalty_won`/`att_pen_goal` counts so the gross totals stay reconstructible if ever needed | P2 |
| 14 | Triage the `expected_goals_nonpenalty ≠ openplay + setplay` residual (24.9% of rows, ≤ `0.0179`) and confirm `expected_goals_freekick ⊂ expected_goals_setplay` on the full corpus, not just the 2023-24 file | P2 |

---

*End of report.*

