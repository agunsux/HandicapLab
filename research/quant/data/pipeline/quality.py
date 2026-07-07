import pandas as pd
from typing import Dict

def compute_data_quality_score(df: pd.DataFrame) -> Dict:
    """
    Computes a Data Quality Score out of 100 based on various metrics.
    Returns a dictionary of metrics and the overall score.
    """
    metrics = {}
    
    total_rows = len(df)
    if total_rows == 0:
        return {"Overall Quality Score": 0.0}
        
    # 1. Missing Data (Check core columns for nulls)
    core_cols = ['home_team_id', 'away_team_id', 'home_goals', 'away_goals', 'date', 'league_id']
    missing_ratio = df[core_cols].isnull().sum().sum() / (total_rows * len(core_cols))
    metrics['Missing Data'] = max(0, 100 - (missing_ratio * 100))
    
    # 2. Duplicate Match UUIDs
    dupe_ratio = df.duplicated(subset=['match_uuid']).sum() / total_rows
    metrics['Duplicates'] = max(0, 100 - (dupe_ratio * 100))
    
    # 3. Odds Coverage (Check how many matches have at least one bookmaker odds)
    odds_cols = [c for c in df.columns if c.startswith('odds_')]
    if odds_cols:
        has_odds_ratio = df[odds_cols].notnull().any(axis=1).sum() / total_rows
        metrics['Odds Coverage'] = has_odds_ratio * 100
    else:
        metrics['Odds Coverage'] = 0.0
        
    # 4. Valid Odds (Odds must be >= 1.0)
    if odds_cols:
        invalid_odds_ratio = (df[odds_cols] < 1.0).any(axis=1).sum() / total_rows
        metrics['Valid Odds'] = max(0, 100 - (invalid_odds_ratio * 100))
    else:
        metrics['Valid Odds'] = 0.0
        
    # 5. Team Mapping Coverage (handled implicitly if ID is None, but let's check None IDs)
    unmapped_team_ratio = (df['home_team_id'].isnull() | df['away_team_id'].isnull()).sum() / total_rows
    metrics['Team Mapping'] = max(0, 100 - (unmapped_team_ratio * 100))
    
    overall_score = sum(metrics.values()) / len(metrics)
    
    return {
        "metrics": metrics,
        "overall_score": overall_score
    }
