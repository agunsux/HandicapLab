# Dribble360 — Feature Decision Matrix

> **Scope**: per-feature retention / rejection decision for the Dribble360 Elite
> offline warehouse. Research-only namespace.
> **Companion artefacts**:
> - `docs/providers/DRIBBLE360_SALMO_MAX_VALUE_REPORT.md` (findings & narrative)
> - `data/research/dribble360/quality/DRIBBLE360_FEATURE_QUALITY.json` (all 303 fields, machine-readable)
> - `data/research/dribble360/coverage/DRIBBLE360_FEATURE_COVERAGE.json` (league × season × feature matrix)
>
> **Provenance**: `Dribble360` `/team_matches`, Elite entitlement, offline harvest.
> 70,392 records / 6 seasons (2020/21 → 2025/26) / 303 field names.

---

## 0. How To Read This Matrix

### Decision classes

| Class | Count | Meaning |
|---|---|---|
| `RESEARCH` | **127** | Usable for research/feature engineering. `coveragePct ≥ 50`, not constant, no impossibility flag. |
| `LICENSE_REVIEW_LOW_COVERAGE` | **115** | `coveragePct < 50` (observed range **0.38% – 49.85%**). Retained but gated behind a licensing review. |
| `NOT_AVAILABLE` | **42** | Field is **always null** across the entire corpus. Not a feature. |
| `REJECT` | **19** | Identifiers/labels, constants, or provably defective values. |

**The 50% coverage threshold is the empirical cut** between the two middle
classes: the highest `LICENSE_REVIEW_LOW_COVERAGE` field is 49.85% and the lowest
`RESEARCH` field is 50.06%.

> **43 fields are flagged `ALWAYS_NULL`, but only 42 are classed `NOT_AVAILABLE`.**
> The 43rd, `direct_setpiece_goals`, is simultaneously constant (value `1`) and is
> therefore counted once under `REJECT`/`CONSTANT`. The two lists are not
> interchangeable.

### Leakage classes

| Class | Count | Meaning |
|---|---|---|
| `POST_MATCH_ONLY` | **40** | Curated outcome set (goals, shots, saves, cards…). **Prohibited as a feature.** |
| `PRE_MATCH_SAFE_AS_LAG` | **256** | **Current-match** value. Pre-match-safe **only** after `shift(1)` within team. |
| `N/A` | 7 | Non-feature identifiers. |

> **No-Future-Leakage invariant**: every `PRE_MATCH_SAFE_AS_LAG` field must be
> consumed strictly as `shift(1)` within team. There is **no** legitimate way to
> use a same-match Dribble stat as a pre-kickoff feature.

> ⚠️ **Leakage-interpretation hazard — read before wiring xG into a model.**
> `PRE_MATCH_SAFE_AS_LAG` does **not** mean "known before kickoff". It means the
> raw value is a *current-match* statistic that becomes a legal feature only once
> lagged. **Every one of the 256 fields in this class is a current-match
> statistic**; the vendor emits nothing that is genuinely known pre-kickoff.
>
> This is the single highest-risk misreading in the whole dataset, because all
> **18 `expected_*` (xG/xA) fields** sit in this class — including the P0
> `expected_goals_nonpenalty`. Same-match xG is a *post-match measurement* of the
> match being predicted. Using it unlagged is direct target leakage and would
> produce an extraordinary, non-reproducible "edge". Any SALMO integration must
> lag xG by at least one fixture per team (`shift(1)` / rolling mean of *prior*
> matches only). The artefact's companion `temporalSafety` field
> (`PRE_MATCH_SAFE_IF_LAGGED`) carries the same meaning and is not a second
> opinion.

### Coverage is conditional

`null` means zero for count fields (see report §4.3). Therefore:
- published `min` for count fields is `1` (zeros were dropped), and
- published `mean` is **conditional-on-nonzero and biased upward**.

Never use the vendor `mean` as a base rate. Reconstruct from
`P(nonzero) × mean` over the whole population, or compute directly from raw rows.

---

## 1. REJECT — Blockers & Non-Features

### 1.1 Defective values (must never enter a model)

| Field | Defect | Evidence | Required handling |
|---|---|---|---|
| `goals_conceded` | **×11 scale inflation** | 39,703/39,848 admissible nonzero pairs reconcile **exactly at ×11 (99.64%)**; median ratio 11; 145 pairs (0.36%) are genuine **×1** rows in a French-cup feed segment | Derive as `opponent.goals ?? 0`. **Never** divide by 11. |
| `clean_sheet` (derived) | Inherits the ×11 defect | — | Derive from corrected conceded. |
| `expected_goals` | **Redundant affine aggregate** — *not* corrupt | `expected_goals − expected_goals_nonpenalty` ∈ {0 (85.02%), 0.7884, 1.5768, 2.3652}; **0 rows** are non-multiples of the fixed penalty-xG constant `0.7884` over 8,908 rows | Use `expected_goals_nonpenalty` / `expected_goals_openplay`. Reconstruct gross only if needed. |
| `expected_goals_conceded` | Same, conceded side | mirror of the above | Use `expected_goals_nonpenalty_conceded`. |
| `expected_assists` | **Redundant** | `= openplay + setplay`, exact in **96.77%** of rows once both sides are rounded to the vendor's 4-dp grid (max residual `2.0e-04`) | Drop; keep the two components. |
| `expected_goals_freekick` | **Subset, not additive** | `openplay + setplay + freekick` over-counts in **3,033/3,033 rows** (mean `+0.0711`) | Do **not** sum free-kick xG on top of set-play. |

### 1.2 Identifiers / labels (not features)

`match_id` · `team_id` · `side` · `match_slug` · `formation` · `formation_used` · `last_updated`

`formation` is populated but is a categorical label rather than a measurable
feature; `formation_used` is declared always-null. Both are treated as metadata
and excluded from modelling inputs.

---

## 2. NOT_AVAILABLE — The 42 Always-Null Fields

These are **absent**, not sparse. Their presence in the 303-field schema is a
vendor schema artefact. Do **not** plan features around them.

```
red_cards                      yellow_cards                  second_yellow_cards
penalties                      fk_foul_won                   fk_foul_lost
possession_percentage          contentious_decision          crosses_18yard
crosses_18yardplus             first_half_goals              formation_used
own_goal_accrued               pts_dropped_winning_pos       pts_gained_losing_pos
poss_won_def_3rd               poss_won_mid_3rd              poss_won_att_3rd
shots_conc_onfield             opposition_passes             defensive_actions
ppda                           direct_corner_goals           direct_setpiece_goals
expected_goals_ontarget        expected_goals_ontarget_nonpenalty
expected_goals_ontarget_freekick
expected_goals_ontarget_conceded
expected_goals_ontarget_nonpenalty_conceded
sca                            gca                           sca_pass_live
sca_pass_dead                  sca_take_on                   sca_shot
sca_fouled                      sca_def                       gca_pass_live
gca_pass_dead                  gca_take_on                   gca_shot
gca_fouled                      gca_def
```

### 2.1 Material consequences for SALMO

- **Possession is NOT available.** `possession_percentage` is always null, and so
  are `ppda`, `opposition_passes`, `defensive_actions`. There is no direct
  possession or pressing metric in this provider. Possession must be
  **approximated** from pass-volume shares (`total_pass`, `accurate_pass`).
- **Cards and fouls are NOT available** (`red_cards`, `yellow_cards`,
  `penalties`, `fk_foul_won/lost` are null; only `total_yellow_card` and
  `fouled_final_third` are populated).
- **`sca`/`gca` (shot-creating / goal-creating actions) are NOT available.**
- **On-target xG is NOT available** — only gross xG variants.

---

## 3. The xG Family — Highest-Value Retention Block

**This is the single most important positive finding of the audit.** A prior
report declared xG unavailable (0% coverage). That was **incorrect** — it
inspected only the bare `expected_goals` field name path and missed that the
decomposed variants are populated.

| Field | Coverage | min | max | mean (conditional) | Decision |
|---|---|---|---|---|---|
| `expected_goals` / `_conceded` | **75.64%** | 0.0003 | 9.28032 | 1.4068 | **REJECT — redundant affine aggregate** |
| `expected_goals_nonpenalty` | **75.63%** | 0.0003 | 8.49192 | 1.2770 | **P0 RESEARCH** |
| `expected_goals_nonpenalty_conceded` | **75.63%** | 0.0003 | 8.49192 | 1.2770 | **P0 RESEARCH** |
| `expected_goals_openplay` | 75.48% | 0.0015 | 7.5774 | 0.9904 | RESEARCH |
| `expected_goals_rf` | 74.99% | 0.0027 | 6.3192 | 0.7402 | RESEARCH |
| `expected_assists_openplay` | 75.68% | 3e-08 | 7.27275 | 0.8519 | RESEARCH |
| `expected_assists_setplay` | 75.67% | 0.0000131 | 1.20983 | 0.1089 | RESEARCH |
| `expected_goals_lf` | 72.19% | 0.0003 | 4.4129 | 0.4527 | RESEARCH |
| `expected_goals_setplay` | 69.96% | 0.0002 | 3.0601 | 0.3119 | RESEARCH |
| `expected_goals_hd` | 63.52% | 0.0001 | 2.8076 | 0.2966 | RESEARCH |
| `expected_goals_freekick` | 26.13% | 0.0001 | 0.5311 | 0.0719 | LICENSE_REVIEW_LOW_COVERAGE — **subset of `_setplay`, never additive** |
| `expected_goals_ontarget` (+4 variants) | **0%** | — | — | — | NOT_AVAILABLE |

### 3.1 Validity signals

- `expected_goals` mean of **1.4068 per team-match** is consistent with real
  world xG (~1.3–1.45) — a strong plausibility check.
- `expected_goals_nonpenalty` (1.2770) is correctly **lower** than gross
  `expected_goals` (1.4068), matching the penalty-xG share (≈0.13), and 1.277
  sits squarely in the real-world non-penalty-xG band (≈1.2–1.3).
- `expected_goals` and `expected_goals_conceded` share corpus-wide statistics
  **exactly** (0.0003 / 9.28032 / 1.4068). This is the HOME↔AWAY mirror
  symmetry and confirms the two sides reconcile.
- `expected_goals ≥ expected_goals_nonpenalty` holds with **0 violations /
  5,000 rows** — the non-penalty column is internally self-consistent.

### 3.2 Nulls are **not** zeros for xG (unlike the count fields)

For count fields `null` is a confirmed zero-encoding (§7.3 of the
max-value report). For xG it **cannot** be: treating the ~24.4% nulls as zeros
would imply an unconditional non-penalty xG of `1.277 × 0.7563 = 0.966`, which is
implausible for top-league football. The correct reading is that xG nulls are
**missing rows** (league/season cells with no xG in the vendor feed, e.g. the
0% `expected_goals_ontarget` family), so all published xG `mean` values are
**conditional on non-null** and are *usable as base rates* without the zero-bias
correction that the count fields need. This asymmetry matters: do **not** blanket
`fillna(0)` a frame that mixes xG and count columns.

### 3.3 Why the gross aggregates are REJECT — **redundancy, not corruption**

> ⚠️ **Self-correction.** An earlier draft of this matrix called `expected_goals`
> *"internally impossible"* because `expected_goals − (openplay + setplay)` was
> nonzero in ~36% of rows. That inference was **wrong**: the right-hand side
> omitted penalty xG. Re-probed over 8,908 admissible rows with
> `scripts/research/dribble360/d360_xg_decomp_probe.mjs` (read-only, offline).

**Verified: `expected_goals = expected_goals_nonpenalty + 0.7884 × k`**

| `gross − nonpenalty` | rows | share |
|---|---|---|
| `0` (no penalty) | 7,574 | **85.02%** |
| `0.7884` = 1 × 0.7884 | 1,221 | 13.71% |
| `1.5768` = 2 × 0.7884 | 108 | 1.21% |
| `2.3652` = 3 × 0.7884 | 5 | 0.06% |
| **not** an integer multiple of `0.7884` | **0** | **0.00%** |

`0.7884` is a **fixed vendor penalty-xG constant**; `k ∈ {0,1,2,3}` is the number
of penalties. The gross column therefore adds **no independent degrees of
freedom** — it is an affine function of `nonpenalty` plus a constant times a
count. It also destroys the open-play/set-piece split, which is the analytically
interesting signal. **Rule: consume the components, reconstruct the gross total
on demand; never store it as an independent feature.**

| Identity tested | n | exact | negatives | mean Δ | max \|Δ\| | Verdict |
|---|---|---|---|---|---|---|
| `expected_assists` vs `openplay + setplay` (raw) | 8,908 | 55.99% | 2,024 | 3e-06 | 1.5e-04 | — |
| `expected_assists` vs `openplay + setplay` (**4-dp rounded**) | 8,908 | **96.77%** | 81 | 3e-06 | **2.0e-04** | **redundant → REJECT** |
| `expected_goals_nonpenalty` vs `openplay + setplay` | 8,211 | 75.07% | 1,053 | 2.7e-05 | 0.0179 | near-identity, minor vendor residual |
| `expected_goals_nonpenalty` vs `openplay + setplay + freekick` | 3,033 | **0.00%** | **3,033** | 0.0711 | 0.3321 | **freekick ⊂ setplay → do not add** |
| `penalty-xG residual ≥ 0` | 8,908 | 85.02% (=0) | **0** | 0.1285 | 2.3652 | invariant holds |

The raw `expected_assists` figure looks weak only because the vendor rounds each
column **independently to 4 dp**; on the vendor's own grid the identity closes at
96.77%. `expected_goals_freekick` is already inside `expected_goals_setplay`, so
`openplay + setplay + freekick` over-counts **100%** of rows.

---

## 4. Suspected Column Aliases (7 Deterministic Groups)

Two fields sharing identical `(nonNullCount, min, max, mean)` across the entire
corpus are near-certainly the same underlying column exported twice. Detected
deterministically:

| Group | Interpretation |
|---|---|
| `poss_lost_all` ≡ `poss_lost_ctrl` | same column |
| `total_clearance` ≡ `effective_clearance` | same column |
| `turnover` ≡ `unsuccessful_touch` | same underlying event |
| `interception` ≡ `interception_won` | same column |
| `head_clearance` ≡ `effective_head_clearance` | same column |
| `blocked_cross` ≡ `effective_blocked_cross` | same column |
| `att_fastbreak` ≡ `shot_fastbreak` | same underlying event |

**Rule**: collapse each group to one feature before modelling. Treating them as
independent features would inject perfect collinearity and inflate apparent
feature count by 7.

Home/away mirror pairs (`duel_won`/`duel_lost`, `expected_goals`/`_conceded`) are
**not** aliases; they are a data-validity signal and are retained separately.

---

## 5. Constant Fields (8)

Single-occurrence constants — zero modelling value, likely a default sentinel:

`att_obp_goal` · `att_pen_miss` · `att_obox_own_goal` · `back_pass` ·
`rescinded_red_card` · `six_second_violation` · `keeper_goals` ·
`direct_setpiece_goals`

**Decision**: `REJECT` — no variance, cannot inform any model.

