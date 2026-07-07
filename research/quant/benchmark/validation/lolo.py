import pandas as pd
from typing import Generator, Tuple

def lolo_split(df: pd.DataFrame, target_leagues: list = None) -> Generator[Tuple[pd.DataFrame, pd.DataFrame, str], None, None]:
    """
    Leave-One-League-Out Validation.
    Yields (train_df, test_df, test_league_id)
    """
    if 'league_id' not in df.columns:
        raise ValueError("DataFrame must contain 'league_id' for LOLO validation.")
        
    all_leagues = df['league_id'].unique()
    leagues_to_test = target_leagues if target_leagues else all_leagues
    
    for league in leagues_to_test:
        if league not in all_leagues:
            continue
            
        test_df = df[df['league_id'] == league].copy()
        train_df = df[df['league_id'] != league].copy()
        
        # Verify Generalization Security
        assert league not in train_df['league_id'].unique(), f"CRITICAL: LOLO Leakage detected. League {league} found in Train set!"
        
        yield train_df, test_df, league
