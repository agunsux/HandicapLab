import pandas as pd
import numpy as np

def walk_forward_split(df: pd.DataFrame, time_col='date', test_years=1):
    """
    Generator that yields (train_idx, test_idx) for walk-forward validation.
    Splits by year.
    """
    df = df.sort_values(by=time_col)
    years = df[time_col].dt.year.unique()
    years = sorted(years)
    
    if len(years) < 2:
        raise ValueError("Dataset does not span enough years for walk-forward validation.")
        
    for i in range(1, len(years)):
        train_years = years[:i]
        test_year = years[i]
        
        train_mask = df[time_col].dt.year.isin(train_years)
        test_mask = df[time_col].dt.year == test_year
        
        train_idx = df[train_mask].index
        test_idx = df[test_mask].index
        
        if len(train_idx) == 0 or len(test_idx) == 0:
            continue
            
        yield train_idx, test_idx, f"Train:{min(train_years)}-{max(train_years)}_Test:{test_year}"

def leave_one_league_out_split(df: pd.DataFrame, league_col='competition_id'):
    """
    Generator that yields (train_idx, test_idx) for Leave-One-League-Out validation.
    """
    leagues = df[league_col].unique()
    
    for league in leagues:
        test_mask = df[league_col] == league
        train_mask = ~test_mask
        
        yield df[train_mask].index, df[test_mask].index, f"Test_League_{league}"
