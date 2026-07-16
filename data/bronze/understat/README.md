# Bronze Layer — Understat Provider

## Purpose

The Bronze Layer is the **immutable raw storage** layer of the HandicapLab Lakehouse architecture. It retains source data exactly as ingested, without transformation, enrichment, or modification. This provides:

- **Audit trail**: Original source data is preserved for compliance and reproducibility.
- **Replay capability**: Pipelines can be rebuilt from raw data at any time.
- **Source-of-truth**: No derived or computed values pollute the raw layer.

## Immutable Storage Policy

- Files in the Bronze Layer are **write-once, read-many**.
- Once written, a file **MUST NOT** be modified, overwritten, or deleted.
- Corrections are introduced by writing a **new version** of the file, not by mutating the existing one.
- The `version` field in `metadata.json` is incremented for each new revision.

## Supported Provider

| Provider    | Data Source              | Coverage                          |
|-------------|--------------------------|-----------------------------------|
| `understat` | Understat (scraped)      | Season summary tables (xG-based)  |

Future providers (e.g., `football-data`, `api-football`, `fbref`) will be added as sibling directories alongside `understat/`.

## Supported Leagues

| Directory  | League Name             |
|------------|-------------------------|
| `EPL`      | English Premier League  |
| `LaLiga`   | La Liga                 |
| `SerieA`   | Serie A                 |
| `Bundesliga` | Bundesliga            |
| `Ligue1`   | Ligue 1                 |

## Supported Seasons

```
2015-2016  2016-2017  2017-2018  2018-2019  2019-2020
2020-2021  2021-2022  2022-2023  2023-2024  2024-2025
2025-2026
```

## Directory Structure

```
data/bronze/understat/
├── README.md
├── EPL/
│   ├── 2015-2016/
│   │   ├── season_table.json   # Season summary table
│   │   ├── matches.json        # Match-level data (placeholder)
│   │   └── metadata.json       # Dataset metadata
│   ├── 2016-2017/
│   │   └── ...
│   └── ...
├── LaLiga/
├── SerieA/
├── Bundesliga/
└── Ligue1/
```

## Naming Convention

- **Directory structure**: `{provider}/{league}/{season}/`
- **Season format**: `YYYY-YYYY` (e.g., `2015-2016`)
- **League format**: PascalCase (e.g., `EPL`, `LaLiga`, `SerieA`, `Bundesliga`, `Ligue1`)
- **Provider format**: lowercase (e.g., `understat`)

## File Definitions

### `season_table.json`

Season summary table containing team-level aggregated statistics.

**Fields** (Understat provider):

| Field     | Type    | Description                    |
|-----------|---------|--------------------------------|
| `number`  | integer | League table position          |
| `team`    | string  | Club name                      |
| `matches` | integer | Matches played                 |
| `wins`    | integer | Wins                           |
| `draws`   | integer | Draws                          |
| `loses`   | integer | Losses                         |
| `goals`   | integer | Goals scored                   |
| `ga`      | integer | Goals against                  |
| `points`  | integer | League points                  |
| `xG`      | number  | Expected goals (accumulated)   |
| `xGA`     | number  | Expected goals against         |
| `xPTS`    | number  | Expected points                |

**Status**: Migrated for EPL. Placeholder (empty array) for other leagues.

### `matches.json`

Match-level data (future). Currently a placeholder empty array.

When populated, each record will represent an individual match with team, score, xG, and contextual metadata.

**Status**: Placeholder (empty array) for all leagues and seasons.

### `metadata.json`

Dataset metadata for provenance and pipeline tracking.

**Fields**:

| Field          | Type    | Description                                |
|----------------|---------|--------------------------------------------|
| `provider`     | string  | Data provider name (e.g., `understat`)     |
| `league`       | string  | Full league name                           |
| `season`       | string  | Season identifier (e.g., `2015-2016`)      |
| `dataset`      | string  | Dataset type (`season_table` or `matches`) |
| `version`      | integer | Dataset version (starts at 1)              |
| `status`       | string  | `migrated`, `placeholder`, or `imported`   |
| `record_count` | integer | Number of records in the dataset           |
| `checksum`     | string? | SHA-256 hash of file content (future)      |
| `imported_at`  | string? | ISO 8601 timestamp of import               |

## Future Expansion

### Additional Providers

When new data providers are added, create sibling directories:

```
data/bronze/
├── understat/       # Current provider
├── football-data/   # Future: Football-Data.org
├── api-football/    # Future: API-Football
├── fbref/           # Future: FBref
└── ...
```

Each provider follows the same `{league}/{season}/` structure, allowing the Silver Layer to merge across providers by league and season.

### Additional Leagues

To add a new league, create a new league directory under each provider and populate with the same three files (`season_table.json`, `matches.json`, `metadata.json`).

## Import Workflow

1. **Place files** in the appropriate `{provider}/{league}/{season}/` directory.
2. **Replace** `season_table.json` and/or `matches.json` with real data.
3. **Update** `metadata.json`:
   - Set `status` to `imported`
   - Update `record_count` to match the data
   - Set `imported_at` to current timestamp
   - Increment `version` if replacing an existing file
4. **Cherry-pick** into Silver Layer via the merge engine (no Bronze files are ever modified).

## Data Integrity

- All EPL season tables (2015-2016 through 2025-2026) have been migrated from the legacy structure.
- JSON content is preserved exactly as ingested — no fields renamed, no data reformatted.
- Non-EPL leagues contain placeholder empty arrays ready for future import.