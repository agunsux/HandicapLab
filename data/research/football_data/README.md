# football-data.co.uk research evidence layer (SALMO)

**Status: RESEARCH ONLY — never a production read path.**
`football-data.co.uk` licensing forbids automated, AI-assisted and commercial use.
Nothing in this namespace may be surfaced to end users or fed into production
predictions. It exists to produce *evidence* (audits, calibration studies,
market-efficiency measurements) that is then re-derived from licensed providers.

## Why this namespace exists

The production pipeline (`src/historical/europe/`) reads the same source but
freezes it into `data/golden/europe/`. That gold layer is **loaded by the app in
production**, so it must not be mutated by research. This namespace is the
fail-closed alternative:

```
src/research/football-data/researchPaths.ts   ← the single safety chokepoint
```

Every research write must go through `researchDir()` / `researchFile()`, which
call `assertResearchSafePath()`. That gate rejects:

* the production gold directory `data/golden/europe/`
* each of the 8 production-loaded gold artifacts, individually
* any path escaping the research root (`../..` traversal)

`isProductionGoldPath()` exposes the same classification for tests and guards.

## Layout

| Path | Produced by | Committed |
| --- | --- | --- |
| `data/research/football_data/SOURCE_REALITY_AUDIT.json` | `npm run research:fd:audit` | yes (small evidence artifact) |
| `data/research/football_data/MARKET_METADATA_SUMMARY.json` | `npm run research:fd:meta` | yes (small evidence artifact) |
| `data/research/football_data/MARKET_METADATA.jsonl` | `npm run research:fd:meta` | **no** (~54 MB, reproducible) |

## Commands

```bash
npm run research:fd:audit   # raw-file schema + market availability + D5 defects
npm run research:fd:meta    # de-vigged, CLV-gated research market table
npm run test:research:fd    # isolation + source-reality regression tests
npm run typecheck           # tsc --noEmit across the repo
```

All three are read-only with respect to `data/golden/europe/`.

## Facts this source can actually express

Established empirically from the raw headers of all 28 bronze files, **not**
inferred from the gold rows (so the audit can detect mislabeling instead of
inheriting it):

| Fact | Value |
| --- | --- |
| Source generations | 28 files, drifting 61 → 132 columns |
| `ERA1_BETBRAIN` | 4 seasons (2015-16 … 2018-19): Pinnacle **1X2 only**; no `AHh`, no `PAHH/PAHA`, no `PSH/PSD/PSA` |
| `ERA2_PINNACLE` | 7 seasons (2019-20 … 2025-26): full Pinnacle `1X2` + `AH` + `OU` families |
| OU depth | exactly `[2.5]` — **one** line, **zero** quarter lines |
| AH depth (Pinnacle closing) | 26 distinct lines, −3.75 … +3, incl. quarters |
| BTTS | **absent** in every generation |
| Snapshots | `opening` and `closing` only — no T-minus horizon grid |
| Unused-but-present columns | 136 (market Max/Avg across books, extra bookmakers, kickoff `Time`) |

## Known defect carried by the frozen gold layer (finding D5)

`src/historical/europe/marketOdds.ts` emits AH-**opening** and OU-**opening** rows
labelled `pinnacle`. For 2015-16 → 2018-19 the source has **no Pinnacle AH/OU
columns at all**, so those 5,858 + 5,858 rows are actually `BbAHh` +
`BbAvAHH/AHA` — the *BetBrain market average* — while the same numbers are also
emitted as a correctly-labelled `betbrain` row.

**CLV computed on those rows is invalid.** The research layer therefore does not
trust the label; it recomputes legality from the raw era via
`erasWhereTradeable()` and emits `clv_eligible: false` +
`veto_reason: ERA_IMPOSSIBLE_PROVENANCE`:

| Market / snapshot | rows | CLV-eligible | mean margin |
| --- | --- | --- | --- |
| ML opening | 17,796 | 17,796 | 3.756 % |
| ML closing | 11,936 | 11,936 | 3.270 % |
| AH opening | 17,785 | 6,068 | 3.443 % |
| AH closing | 6,079 | 6,079 | 2.523 % |
| OU opening | 17,795 | 6,079 | 5.164 % |
| OU closing | 6,080 | 6,080 | 4.113 % |

Totals: 77,471 rows emitted, 54,038 CLV-eligible, 23,433 vetoed
(11,716 `AGGREGATE_PRICE` + 11,716 `ERA_IMPOSSIBLE_PROVENANCE` + 1 `MISSING_LINE`).

## Fixing D5

The defect is **not** repaired here — the gold layer stays frozen byte-for-byte.
The production fix belongs in `marketOdds.ts` (stop emitting the mislabeled
`pinnacle` rows for ERA1, or relabel them `betbrain_average`) and must be
accompanied by a gold-layer version bump plus re-validation. Until then, the
research layer's veto is the only protection.
