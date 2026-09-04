# ARCHIVE SPECIFICATION: UNDERSTAT.COM (EXPECTED GOALS & ADVANCED METRICS)

**Target URL:** `https://understat.com/`  
**Classification:** Secondary Intelligence & Archival Statistical Provider  
**Purpose:** Match-level and season-level Expected Goals (xG), Expected Goals Against (xGA), Expected Points (xPTS), Deep Completions, and Shot-level coordinate maps for top European leagues.  
**Storage Path:** `data/bronze/understat/{League}/{Season}/`  
**Governance Invariant:** Understat is strictly an explanatory / research data source. It is NOT a source of sharp betting odds or Pinnacle closing lines. Any feature derived from Understat must respect the temporal invariant: `timestamp < kickoff_utc` (no post-match xG leakage into pre-match models).

---

## 1. SUPPORTED LEAGUES & SEASONS

Understat covers 6 leagues historically from season 2014/15 to present:

| Understat Slug | Canonical League ID | Competition Name | First Season |
| :--- | :--- | :--- | :---: |
| `EPL` | `ENG-PL` | Premier League | 2014/15 |
| `La_liga` | `ESP-LALIGA` | La Liga | 2014/15 |
| `Serie_A` | `ITA-SERIEA` | Serie A | 2014/15 |
| `Bundesliga` | `DEU-BUNDESLIGA` | Bundesliga | 2014/15 |
| `Ligue_1` | `FRA-LIGUE1` | Ligue 1 | 2014/15 |
| `RFPL` | `RUS-PL` | Russian Premier League | 2014/15 |

---

## 2. URL PATTERNS & SCRAPING PROTOCOL

Understat does not expose an open REST API with API keys. Instead, pages server-render JSON payloads inside inline `<script>` tags using `JSON.parse(decodeURI(...))` or `JSON.parse('...')`.

### 2.1 League Season Overview Endpoint
- **URL Pattern:** `https://understat.com/league/{League_Slug}/{Season_Start_Year}`
- **Examples:**
  - `https://understat.com/league/EPL/2024` (2024/25 season)
  - `https://understat.com/league/La_liga/2025` (2025/26 season)
  - `https://understat.com/league/Serie_A/2024`
  - `https://understat.com/league/Bundesliga/2024`
  - `https://understat.com/league/Ligue_1/2024`
- **Embedded JavaScript Variables:**
  - `datesData`: Array of all fixtures in the season with `id`, `isResult`, `datetime`, `h` (home team), `a` (away team), `goals` (`{h, a}`), `xG` (`{h, a}`), `forecast` (win/draw/loss probabilities).
  - `teamsData`: Per-team aggregates across the season: matches, wins, draws, losses, goals, GA, points, xG, xGA, xPTS, PPDA (Passes Per Defensive Action), deep completions.
  - `playersData`: Individual player statistics (goals, assists, xG, xA, key passes, shots, time played).

### 2.2 Match Details & Shot-Level Endpoint
- **URL Pattern:** `https://understat.com/match/{understat_match_id}`
- **Example:** `https://understat.com/match/26620`
- **Embedded JavaScript Variables:**
  - `shotsData`: List of every shot taken during the match:
    - `id`: Unique shot ID
    - `minute`: Match minute
    - `result`: 'Goal', 'SavedShot', 'BlockedShot', 'MissedShots', 'ShotOnPost'
    - `X`, `Y`: Pitch coordinates (0.0 to 1.0)
    - `xG`: Calculated expected goal value
    - `player`: Striker name
    - `h_a`: 'h' (Home) or 'a' (Away)
    - `situation`: 'OpenPlay', 'FromCorner', 'SetPiece', 'Penalty', 'DirectFreekick'
    - `shotType`: 'LeftFoot', 'RightFoot', 'Head', 'OtherBodyPart'
    - `match_id`: Understat match identifier
    - `h_team`, `a_team`: Club names
  - `rostersData`: Lineups and player-level match ratings/xG contributions.

---

## 3. DECODING PROTOCOL (NODE.JS IMPLEMENTATION)

Understat encodes string literals in its HTML `<script>` tags using hex escapes (e.g. `\x7B\x22...`). The deterministic extraction procedure is:

```javascript
function extractUnderstatVar(html, varName) {
  // Matches: var {varName} = JSON.parse('...')
  const regex = new RegExp(`var\\s+${varName}\\s*=\\s*JSON\\.parse\\(['"](.*?)['"]\\)`);
  const match = html.match(regex);
  if (!match) return null;
  
  // Clean hex escape characters (\x20, \x7B, etc.)
  const decoded = match[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  return JSON.parse(decoded);
}
```

---

## 4. LAKEHOUSE BRONZE DESTINATION

When scraped, raw payloads must be stored in `data/bronze/understat/{League}/{Season}/`:

```text
data/bronze/understat/
├── EPL/
│   ├── 2024-2025/
│   │   ├── season_table.json    # teamsData
│   │   ├── fixtures.json        # datesData
│   │   ├── players.json         # playersData
│   │   └── metadata.json        # Retrieval timestamp & source URL
│   └── 2025-2026/
├── LaLiga/
├── SerieA/
├── Bundesliga/
└── Ligue1/
```

---

## 5. REPRODUCIBLE SCRAPER UTILITY

The scraper utility is registered at [`scripts/scrape-understat-archive.mjs`](file:///c:/Users/RYZEN/.antigravity-ide/HandicapLab/scripts/scrape-understat-archive.mjs).  
To invoke on demand:
```bash
node scripts/scrape-understat-archive.mjs --league EPL --season 2024
```
All scraped files adhere to write-once, read-many bronze storage invariants.
