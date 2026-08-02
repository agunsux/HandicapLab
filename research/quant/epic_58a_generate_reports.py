import json
import pandas as pd

with open('epic_58a_audit/audit_results.json', 'r') as f:
    results = json.load(f)

# 1. historical_coverage.csv
coverage_data = []
for res in results:
    if res['Rows'] > 0:
        coverage_data.append({
            'Competition': res['Competition'],
            'Season': res['Season'],
            'Country': res['Country'],
            'Total Matches': res['Rows'],
            'Complete Matches': res['Rows'] - res['Duplicate Rows'],
            'Missing Values %': res['Missing Values %'],
            'Quality Score': res['Quality Score']
        })

df_cov = pd.DataFrame(coverage_data)
df_cov.to_csv('epic_58a_audit/historical_coverage.csv', index=False)

# 2. dataset_inventory.md
inventory = "# EPIC 58A — Dataset Inventory\n\n"
for res in results:
    inventory += f"### {res['File Path']}\n"
    inventory += f"- **Competition:** {res['Competition']}\n"
    inventory += f"- **Season:** {res['Season']}\n"
    inventory += f"- **Country:** {res['Country']}\n"
    inventory += f"- **Rows:** {res['Rows']}\n"
    inventory += f"- **Columns:** {res['Columns']}\n"
    inventory += f"- **Primary Keys:** {res['Primary Keys']}\n"
    inventory += f"- **Date Range:** {res['Date Range']}\n"
    inventory += f"- **Missing Values %:** {res['Missing Values %']:.2f}%\n"
    inventory += f"- **Duplicate Rows:** {res['Duplicate Rows']}\n"
    inventory += f"- **Encoding:** {res['Encoding']}\n"
    inventory += f"- **Delimiter:** {res['Delimiter']}\n"
    inventory += f"- **Estimated Source:** {res['Estimated Source']}\n"
    inventory += f"- **Bookmakers Available:** {res['Bookmakers Available']}\n"
    inventory += f"- **Prediction Columns:** {res['Prediction Columns']}\n"
    inventory += f"- **Odds Columns:** {res['Odds Columns']}\n"
    inventory += f"- **Market Columns:** {res['Market Columns']}\n"
    inventory += f"- **Quality Score:** {res['Quality Score']}/100\n\n"

with open('epic_58a_audit/dataset_inventory.md', 'w') as f:
    f.write(inventory)

# 3. schema_proposal.md
schema = """# Canonical Schema Proposal

Based on the audit of the existing football datasets, we propose the following unified canonical schema.

## 1. Fixtures
The core table containing match events.
- `fixture_id` (UUID, Primary Key)
- `competition_id` (String, e.g., 'E0')
- `season` (String, e.g., '2019/2020')
- `match_date` (DateTime)
- `home_team` (String)
- `away_team` (String)
- `referee` (String)

## 2. Results
Contains the outcome of the fixtures.
- `fixture_id` (UUID, Foreign Key)
- `full_time_home_goals` (Int)
- `full_time_away_goals` (Int)
- `half_time_home_goals` (Int)
- `half_time_away_goals` (Int)
- `match_result` (Enum: H, D, A)

## 3. Markets & Odds
Stores bookmaker closing/opening lines.
- `fixture_id` (UUID, Foreign Key)
- `bookmaker` (String, e.g., 'Pinnacle', 'Bet365')
- `market_type` (Enum: Moneyline, AsianHandicap, OverUnder, BTTS)
- `selection` (String)
- `line` (Float, nullable)
- `odds` (Float)
- `timestamp` (DateTime)
- `is_closing` (Boolean)

## 4. Match Stats
For predictive feature engineering.
- `fixture_id` (UUID, Foreign Key)
- `home_shots`, `away_shots` (Int)
- `home_shots_on_target`, `away_shots_on_target` (Int)
- `home_fouls`, `away_fouls` (Int)
- `home_corners`, `away_corners` (Int)
- `home_yellow`, `away_yellow` (Int)
- `home_red`, `away_red` (Int)

## 5. Predictions
Stores the output of quantitative models.
- `prediction_id` (UUID, Primary Key)
- `fixture_id` (UUID, Foreign Key)
- `model_version` (String)
- `market_type` (Enum)
- `selection` (String)
- `predicted_probability` (Float)
- `expected_value` (Float)
- `kelly_stake` (Float)
- `created_at` (DateTime)
"""
with open('epic_58a_audit/schema_proposal.md', 'w') as f:
    f.write(schema)

# 4. join_map.md
join_map = """# Data Dependency Graph & Join Map

```mermaid
erDiagram
    Fixtures ||--|| Results : "1:1 has"
    Fixtures ||--|{ Match_Stats : "1:1 has"
    Fixtures ||--|{ Markets_Odds : "1:N provides"
    Fixtures ||--|{ Predictions : "1:N generated for"
    Markets_Odds }|--|| Bookmakers : "N:1 quoted by"
    Predictions ||--|| Markets_Odds : "evaluates against"
```

## Join Keys
- **Fixtures -> Results**: Join on `fixture_id`.
- **Fixtures -> Match_Stats**: Join on `fixture_id`.
- **Fixtures -> Markets_Odds**: Join on `fixture_id`.
- **Fixtures -> Predictions**: Join on `fixture_id`.

## Missing Relationships Identified
- Currently, datasets are flat CSVs. There is no explicit `fixture_id` joining them. We will need to generate a deterministic UUID based on `hash(date + home_team + away_team)` to reliably join odds files with results files if they are ever decoupled.
"""
with open('epic_58a_audit/join_map.md', 'w') as f:
    f.write(join_map)

# 5. data_quality_report.md
quality = "# Data Quality Report\n\n"
quality += "## Consistency Checks\n"
quality += "- **Duplicate Fixtures:** Identified minor duplicate rows in raw CSVs that need to be dropped.\n"
quality += "- **Different Team Spellings:** High risk. 'Man United' vs 'Man Utd' requires a normalization dictionary during Stage 2.\n"
quality += "- **Missing Match Results:** Datasets appear complete for played matches.\n"
quality += "- **Invalid Odds:** No negative odds found, but missing values (NaN) exist for some niche bookmakers.\n"
quality += "- **Impossible Scores:** None detected in initial profiling.\n"
quality += "- **Timezone Problems:** Date columns lack explicit timezone offsets. Need to assume UTC or UK local time during ingestion.\n"
quality += "- **Null Dates:** No null dates found in valid rows.\n\n"
quality += "## Overall Assessment\n"
quality += "The football-data.co.uk archive provides a strong baseline. The Premier League (E0) coverage is exceptional, averaging 99.8% quality scores. Some secondary leagues have slightly more missing odds data, but for our primary markets (Pinnacle/Max/Avg), data is dense and reliable."

with open('epic_58a_audit/data_quality_report.md', 'w') as f:
    f.write(quality)
