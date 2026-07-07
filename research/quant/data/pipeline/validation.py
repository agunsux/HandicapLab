import pandas as pd
from typing import List

class P0ValidationError(Exception):
    pass

def validate_canonical_dataframe(df: pd.DataFrame, required_columns: List[str]):
    """
    Executes P0 fail-fast validations on a dataframe that is supposed to be in Canonical format.
    Throws P0ValidationError if any check fails.
    """
    # 1. Schema Check
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise P0ValidationError(f"Schema Drift: Missing required columns: {missing_cols}")
        
    # 2. Duplicate Check
    if df.duplicated(subset=['match_uuid']).any():
        dupes = df[df.duplicated(subset=['match_uuid'])].shape[0]
        raise P0ValidationError(f"Duplicate Match UUID found: {dupes} duplicates.")
        
    # 3. Missing Teams
    if df['home_team_id'].isnull().any() or df['away_team_id'].isnull().any():
        raise P0ValidationError(f"Found matches with missing Team IDs.")
        
    # 4. Valid Match Status & Scores
    # We only expect FINISHED matches in the historical dataset, but if we allow postponed,
    # we must ensure that if it's FINISHED, scores are present.
    finished_matches = df[df['status'] == 'FINISHED']
    if finished_matches['home_goals'].isnull().any() or finished_matches['away_goals'].isnull().any():
        raise P0ValidationError("Found FINISHED matches with NULL goals.")
        
    # 5. Invalid Odds Check (Scan any column starting with odds_)
    odds_cols = [c for c in df.columns if c.startswith('odds_')]
    for col in odds_cols:
        if (df[col] < 1.0).any():
            raise P0ValidationError(f"Invalid odds (< 1.0) found in column {col}.")
            
    print("[VALIDATION] P0 Checks Passed.")
    return True
