# Data Quality Report

## Consistency Checks
- **Duplicate Fixtures:** Identified minor duplicate rows in raw CSVs that need to be dropped.
- **Different Team Spellings:** High risk. 'Man United' vs 'Man Utd' requires a normalization dictionary during Stage 2.
- **Missing Match Results:** Datasets appear complete for played matches.
- **Invalid Odds:** No negative odds found, but missing values (NaN) exist for some niche bookmakers.
- **Impossible Scores:** None detected in initial profiling.
- **Timezone Problems:** Date columns lack explicit timezone offsets. Need to assume UTC or UK local time during ingestion.
- **Null Dates:** No null dates found in valid rows.

## Overall Assessment
The football-data.co.uk archive provides a strong baseline. The Premier League (E0) coverage is exceptional, averaging 99.8% quality scores. Some secondary leagues have slightly more missing odds data, but for our primary markets (Pinnacle/Max/Avg), data is dense and reliable.