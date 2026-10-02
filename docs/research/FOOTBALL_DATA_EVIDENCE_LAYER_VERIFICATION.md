# SALMO — football-data.co.uk Evidence Layer: Verification Report

**Scope:** isolated research namespace over `src/historical/europe/` + defects D1–D5
**Date:** 2026-10-02 · **Verdict:** PASS (with D5 documented, not yet repaired)
**Source:** `football-data.co.uk` — **RESEARCH EVIDENCE ONLY** (licence forbids automated/AI/commercial use)

---

## 1. Deliverables

| # | Artifact | Purpose |
| --- | --- | --- |
| 1 | `src/research/football-data/researchPaths.ts` | Fail-closed path gate; the **only** write chokepoint |
| 2 | `src/research/football-data/types.ts` | `SnapshotCode`, `ResearchMarketCode`, `LineType`, `PriceProvenance`, `SourceEra`, `SourceFileSchema`, `MarketAvailabilityFact`, `LineInventoryEntry`, `SourceRealityReport` |
| 3 | `src/research/football-data/sourceReality.ts` | Raw-header schema reader, era derivation, streamed read-only gold scan, source-reality audit |
| 4 | `src/research/football-data/marketMeta.ts` | `line_type` / `snapshot` / `provenance` typing, `clv_eligible` veto, de-vig via `DeVigEngine` |
| 5 | `scripts/research/football-data-audit.ts` | `npm run research:fd:audit` |
| 6 | `scripts/research/football-data-market-meta.ts` | `npm run research:fd:meta` |
| 7 | `tests/research/football-data/research-isolation.test.ts` | 6 isolation tests |
| 8 | `tests/research/football-data/source-reality.test.ts` | 6 source-reality/Semantics tests |
| 9 | `data/research/football_data/README.md` | Namespace contract + known facts |
| 10 | `data/research/football_data/SOURCE_REALITY_AUDIT.json` | Audited evidence artifact (committed) |

---

## 2. Defect register

### D1 — FIXED · research/tests mutated production-loaded gold artifacts
`buildHistoricalDataset()` (`ingest.ts`) and `buildMarketOddsDataset()` (`marketOdds.ts`)
now accept `{ persist?: boolean; outputDir?: string }`. Serialisation extracted into
exported `writeHistoricalArtifacts(summary, outputDir)` and
`writeMarketOddsArtifacts(rows, manifest, outputDir)`. Default is `persist: true`, so
production CLI callers (`run.ts`, `oddsRun.ts`) are **byte-for-byte unchanged**.

### D2 — FIXED · test call sites
`tests/historical/europe/expansion.test.ts` and `market-odds.test.ts` pass
`{ persist: false }`. `git status --short data/golden` is **empty** after a full run.

### D3 — FIXED · `tsc --noEmit` failed
Two `TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property` errors in
`tests/canonical-result-sync-bridge.test.ts` were replaced with vitest's supported
`vi.stubEnv('NODE_ENV', 'production')` / `vi.unstubAllEnvs()`.
`npm run typecheck` was added and now exits **0** across the whole repo, including the
new research modules. The bridge test passes standalone (1/1).

### D4 — OPEN · no columnar warehouse
`duckdb`, `@duckdb/node-api`, `apache-arrow`, `parquetjs` are all absent from
`package.json`. The research layer therefore writes JSONL. Not required for this
milestone; listed as remaining work.

### D5 — CONFIRMED, NOT YET REPAIRED · impossible provenance in the frozen gold layer
`marketOdds.ts` (~line 106) emits AH-**opening** and OU-**opening** rows labelled
`pinnacle`, but for 2015-16 → 2018-19 the raw source contains **no Pinnacle AH/OU
columns**. Those values are `BbAHh` + `BbAvAHH/AHA` (BetBrain market average) and are
*simultaneously* emitted as a correctly-labelled `betbrain` row. **CLV on those rows is
invalid.** The research layer vetoes them instead of trusting the label.

---

## 3. Test evidence

---

## 4. Empirical source reality (from raw headers of all 28 bronze files)

Era legitimacy is derived from **raw column availability**, never from the gold rows — so
the audit can *detect* D5 rather than inherit it.

| File generation | Seasons | Columns | Era | Pinnacle AH/OU cols |
| --- | --- | --- | --- | --- |
| `2015-2016` | 2015-16 | 65 | `ERA1_BETBRAIN` | none (only `BbAHh`) |
| `2016-2017` | 2016-17 | 65 | `ERA1_BETBRAIN` | none |
| `2017-2018` | 2017-18 | 65 | `ERA1_BETBRAIN` | none |
| `2018-2019` | 2018-19 | 62 | `ERA1_BETBRAIN` | none |
| `2019-2020` … `2023-2024` | 5 seasons | 106 | `ERA2_PINNACLE` | `AHh`, `AHCh`, OU full |
| `2024-2025` | 2024-25 | 120 | `ERA2_PINNACLE` | full |
| `2025-2026` | 2025-26 | 132 | `ERA2_PINNACLE` | full |

**Findings**

1. Schema drift: 28 files spanning **61 → 132 columns**.
2. `ERA1_BETBRAIN`: 4 seasons. Pinnacle **1X2 only** (`PSCH` present; no `PSH/PSD/PSA`,
   no `AHh`, no `PAHH/PAHA`).
3. `ERA2_PINNACLE`: 7 seasons with the complete Pinnacle 1X2 + AH + OU family.
4. **OU depth is a single point: exactly `[2.5]`, zero quarter lines** (all 28 files).
5. Pinnacle **closing** AH: **26 distinct lines**, −3.75 … +3.0, including quarters
   (−2.75, −2.25, −1.75, −1.25, −0.75, −0.25, +0.25, +0.75, +1.25, +1.75, +2.25).
6. **BTTS is absent** from every generation — zero BTTS columns anywhere.
7. **136 raw columns exist that the current reader ignores** (market `Max*`/`Avg*` across
   books, extra bookmakers, kickoff `Time`) — capability on the table, unexploited.
8. D5 fingerprint: `AH|opening|pinnacle` = **8,897 rows** spanning 2015-16…2025-26, of
   which **5,858 are era-impossible**; the BetBrain aggregate carries exactly those same
   4 seasons (5,858 rows). Identical signature on `OU|opening|pinnacle` (**8,898 rows /
   5,858 impossible**).
9. Genuine observations (not flagged): `ML|opening|pinnacle` 8,898 (both eras),
   `ML|closing|pinnacle` 8,896, `AH|closing|pinnacle` **3,040 rows across exactly the 7
   ERA2 seasons**.

**Limitations (always disclosed in the artifact)**

* `opening` / `closing` are the **only** snapshots the source documents — no T-minus
  horizon grid. This is a hard ceiling on backtest fidelity.
* No live/streaming feed: post-hoc research and backtests only.
* Licensing forbids automated/AI/commercial use — research evidence only.
* Pinnacle price quality degrades after **2025-07-23**; ERA2 recent coverage must be

---

## 5. Research market metadata (`npm run research:fd:meta`)

77,471 rows in 1.06 s. `raw_overround` is the observed bookmaker margin; `fair_odds_*`
are margin-free (edge/EV basis). ML uses Shin (1993) with proportional fallback; AH/OU use
proportional two-way de-vig — **all via the existing `DeVigEngine`**, no probability math
re-implemented.

| Market / snapshot | rows | CLV-eligible | mean margin |
| --- | --- | --- | --- |
| AH closing | 6,079 | 6,079 | 2.523 % |
| AH opening | 17,785 | 6,068 | 3.443 % |
| ML closing | 11,936 | 11,936 | 3.270 % |
| ML opening | 17,796 | 17,796 | 3.756 % |
| OU closing | 6,080 | 6,080 | 4.113 % |
| OU opening | 17,795 | 6,079 | 5.164 % |

Line-type coverage: `ML` 29,732 · `OU_HALF` 23,875 · `AH_QUARTER` 11,646 ·
`AH_WHOLE` 6,814 · `AH_HALF` 5,404.

Vetoes: **23,433** total — `AGGREGATE_PRICE` 11,716 · `ERA_IMPOSSIBLE_PROVENANCE` 11,716 ·
`MISSING_LINE` 1. (11,716 = 5,858 × 2: the AH/OU BetBrain rows *and* the mislabeled
"pinnacle" rows carrying the same numbers.)

Margin sanity check — ML closing 3.270 % (blend of Pinnacle ≈ 2.4 % and bet365 ≈ 4.1 %)
and AH closing 2.523 % (Pinnacle-dominant) are consistent with a genuine two-bookmaker,
margin-bearing sample and **not** with leakage.

---

## 6. Isolation guarantees (verified)

| Attack vector | Result |
| --- | --- |
| Write to `data/research/football_data/**` | **accepted** |
| Write to `data/golden/europe/` (dir) | **refused** |
| Write to each of the 8 production-loaded gold artifacts | **refused** (8/8) |
| `../..` traversal out of the research root | **refused** |
| Research root ≠ production gold dir | **asserted** |
| `data/research/football_data/MARKET_METADATA.jsonl` (54 MB) | **git-ignored** (`.gitignore:133`) |
| `SOURCE_REALITY_AUDIT.json`, `MARKET_METADATA_SUMMARY.json`, `README.md` | tracked via explicit negations |
| `git add -n data/research/football_data` | stages **only** the 2 small artifacts |

  date-gated.


---

## 7. Acceptance checklist

- [x] D1 — persistence opt-out on both builders; production default preserved
- [x] D2 — test call sites no longer mutate production-loaded gold
- [x] D3 — `tsc --noEmit` exits 0; `typecheck` script added
- [ ] D4 — DuckDB/Parquet warehouse (explicitly deferred; dependency decision open)
- [x] D5 — defect **proven** from raw headers, quantified (5,858 + 5,858 rows) and
      **neutralised in the research layer** via `clv_eligible: false`
- [ ] D5 repair in `marketOdds.ts` + gold version bump + re-validation (separate change)
- [x] Research namespace created with a single fail-closed write chokepoint
- [x] 12/12 research tests pass; 31/31 europe tests pass; no regression
- [x] Frozen gold layer untouched after every run (`git status data/golden` empty)
- [x] `research:fd:audit`, `research:fd:meta`, `test:research:fd`, `typecheck` scripts added
- [x] `data/research/` artifact policy encoded in `.gitignore`, verified by `git check-ignore`
- [x] Evidence artifact + namespace README + this report in the repo
- [x] Every limitation disclosed in the artifact itself, not only in prose

---

## 8. What this source can and cannot support

**Supported:** Pinnacle 1X2 opening + closing across both eras (CLV-eligible throughout);
Pinnacle AH opening + closing for the 7 ERA2 seasons (26 lines incl. quarters); Pinnacle
OU at exactly 2.5 for the 7 ERA2 seasons; a real second book (bet365) from 2019-20 as a
comparison book; 136 currently-unused columns for future feature work.

**Not supported:** any OU line other than 2.5; BTTS; a T-minus horizon grid; any ERA1
AH/OU Pinnacle price; automated/AI/commercial use of the source at all.

**Consequence for SALMO:** CLV must be computed **Pinnacle-closing-only**, gated to
`clv_eligible = true`. The 2015-19 AH/OU opening rows can never serve as a CLV reference,
and the ERA1 AH/OU space must be modelled from the BetBrain *average* (a consensus, not a
tradeable price) or abandoned.

| Suite | Result |
| --- | --- |
| `tests/research/football-data` (2 files) | **12/12 PASS**, EXIT=0 |
| `tests/historical/europe` (3 files) | **31/31 PASS** |
| `tests/canonical-result-sync-bridge.test.ts` | **1/1 PASS** |
| Combined `tests/research tests/historical/europe` | 224 tests, 222 passed, 2 failed |
| `npm run typecheck` | **EXIT=0** |
| `npm run research:fd:audit` | **EXIT=0** |
| `npm run research:fd:meta` | **EXIT=0**, 1.06 s |
| `git status --short data/golden` after all runs | **empty** (frozen layer untouched) |

**The 2 combined-suite failures are pre-existing and environmental**:
`tests/research-engine.test.ts` and `tests/research-readiness.test.ts` fail with
`[DatasetRegistry] Failed to register: Invalid API key` — they drive the real Supabase
client (`src/lib/supabase.server`). They were only collected because the glob
`tests/research` also matches `tests/research-*.test.ts`. Neither file is touched by this
change and neither reaches any modified module. Recommendation: add an explicit
`test:research:fd` script (done) rather than broadening the `tests/research` glob.
