# Dribble360 Elite Capability Matrix

## 1. API Endpoint Status (Discovery)

| Endpoint | Status Code | Returns Data | Notes |
|---|---|---|---|
| `/matches` | 200 OK | Yes | Core match corpus |
| `/teams` | 200 OK | Yes | Team master data |
| `/team_matches` | 200 OK | Yes | 303 feature dataset |
| `/player_matches` | 200 OK | Yes | Player level stats |
| `/players` | 200 OK | Yes | Player master |
| `/managers` | 200 OK | Yes | |
| `/referees` | 200 OK | Yes | |
| `/transfers` | 200 OK | Yes | |
| `/leagues` | 404 Not Found | No | |
| `/seasons` | 404 Not Found | No | |
| `/standings` | 404 Not Found | No | |
| `/injuries` | 404 Not Found | No | |
| `/lineups` | 404 Not Found | No | |
| `/events` | 404 Not Found | No | |
| `/statistics` | 404 Not Found | No | |
| `/venues` | 404 Not Found | No | |
| `/h2h` | 404 Not Found | No | |
| `/form` | 404 Not Found | No | |
| `/odds` | 404 Not Found | No | NOT an odds provider |
| `/fixtures/odds` | 404 Not Found | No | |
| `/bookmakers` | 404 Not Found | No | |
| `/markets` | 404 Not Found | No | |
| `/closing-odds` | 404 Not Found | No | |
| `/prematch-odds`| 404 Not Found | No | |
| `/match_odds` | 404 Not Found | No | |

**Rate Limit**: 5000 requests/day (Elite). (Estimated Lite = 500/month).
**BigQuery Access**: NOT AVAILABLE.

## 2. Feature Availability Assessment

| Feature | Status | Notes |
|---|---|---|
| REST API | AVAILABLE | But missing metadata endpoints (leagues/seasons) |
| BigQuery | NOT AVAILABLE | Offline harvest required |
| Event Data | NOT AVAILABLE | /events is 404 |
| XY Coordinates | NOT AVAILABLE | Derived from event data typically |
| Player-Match | AVAILABLE | via /player_matches |
| Team-Match | AVAILABLE | Core dataset, 303 features |
| Match Events | NOT AVAILABLE | |
| Lineups | NOT AVAILABLE | /lineups is 404 |
| Revision History | UNKNOWN | No revision endpoint detected |

## 3. Data Corpus Dimensions

- **Matches**: 44,302 unique match records.
- **Team Matches**: 70,651 records.
- **Players/Teams**: Extracted via respective master endpoints.

> [!WARNING] CRITICAL BUG
> All 7 match files (`matches_*.jsonl`) in the harvest are **byte-identical**. The API did NOT filter by the season parameter, causing a pagination loop that downloaded the same exact 44,302 records for every season batch.

## 4. League & Season Coverage

- **Total Unique Seasons in Corpus**: 214
- **Coverage Levels**: Predominantly high for Whitelist leagues.
- **Whitelist Leagues**: Premier League, Championship, Serie A, Bundesliga, La Liga, Ligue 1, Eredivisie, J1 League, K League, Liga 1 Indonesia.

*(Run `data/research/dribble360/corpus_deep_audit.json` for precise counts per league per season).*

## 5. Field Completeness (Top Features)

The `team_matches` payload contains ~303 fields. A typical record has ~152 non-null fields. 

**High Value (100% Populated)**:
- `match_id`
- `team_id`
- `side`
- `goals`
- `total_scoring_att`
- `ontarget_scoring_att`
- `corner_taken`

**Key Statistical Fields Check**:
- `possession_percentage`
- `ppda`
- `big_chance_created`
- `big_chance_missed`
- `total_offside`
- `expected_goals` (xG) - *VENDOR-DISTORTED (r = -0.2030)*

*(See `corpus_deep_audit.json` for full % values of all 303 fields).*
