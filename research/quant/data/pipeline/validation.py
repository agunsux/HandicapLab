import pandas as pd
from typing import List

class SchemaDriftError(Exception):
    pass

class BusinessValidationError(Exception):
    pass

class StatisticalValidationError(Exception):
    pass


def validate_provider_schema(df: pd.DataFrame, provider_id: str):
    """
    1. SCHEMA VALIDATION
    Validates that the raw provider data has not drifted (e.g. columns renamed or removed).
    """
    if provider_id == 'football_data_co_uk':
        expected = ['HomeTeam', 'AwayTeam', 'Div', 'Date', 'B365H', 'B365D', 'B365A']
        missing = [c for c in expected if c not in df.columns]
        if missing:
            raise SchemaDriftError(f"[{provider_id}] Schema Drift Detected! Missing columns: {missing}")
            
    print(f"[VALIDATION] Tier 1: Schema Intact ({provider_id}).")
    return True


def validate_business_rules(df: pd.DataFrame, required_columns: List[str]):
    """
    2. BUSINESS VALIDATION
    Core rules that govern the physical reality of a football match.
    """
    # Missing crucial UUIDs
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise BusinessValidationError(f"Missing Canonical columns: {missing_cols}")
        
    if df['home_team_id'].isnull().any() or df['away_team_id'].isnull().any():
        raise BusinessValidationError("Matches with missing Team IDs.")
        
    # Date logic
    if 'date' in df.columns:
        dates = pd.to_datetime(df['date'], errors='coerce', dayfirst=True)
        if dates.dt.year.max() > 2050 or dates.dt.year.min() < 1800:
            raise BusinessValidationError("Impossible Date found in dataset.")
            
    # Goals logic
    finished = df[df['status'] == 'FINISHED']
    if 'home_goals_ft' in finished.columns:
        if (finished['home_goals_ft'] < 0).any() or (finished['away_goals_ft'] < 0).any():
            raise BusinessValidationError("Negative goals detected.")
    elif 'home_goals' in finished.columns:
        if (finished['home_goals'] < 0).any() or (finished['away_goals'] < 0).any():
            raise BusinessValidationError("Negative goals detected.")
            
    print("[VALIDATION] Tier 2: Business Rules Passed.")
    return True


def validate_statistical_rules(df: pd.DataFrame):
    """
    3. STATISTICAL VALIDATION
    Checks for impossible statistical anomalies (e.g., odds = 0, xG < 0).
    """
    # Odds bounds
    odds_cols = [c for c in df.columns if c.startswith('odds_')]
    for col in odds_cols:
        if (df[col] <= 1.0).any():
            raise StatisticalValidationError(f"Invalid odds (<= 1.0) found in column {col}.")
            
    # xG bounds
    if 'home_xg' in df.columns:
        if (df['home_xg'] < 0).any():
            raise StatisticalValidationError("Negative xG found.")
            
    # Possession bounds
    if 'home_possession' in df.columns:
        if (df['home_possession'] < 0).any() or (df['home_possession'] > 100).any():
            raise StatisticalValidationError("Possession out of bounds (0-100).")
            
    # Shots logic
    if 'home_shots' in df.columns and 'home_shots_on_target' in df.columns:
        if (df['home_shots_on_target'] > df['home_shots']).any():
            raise StatisticalValidationError("Shots on target exceeds total shots.")
            
    print("[VALIDATION] Tier 3: Statistical Rules Passed.")
    return True
