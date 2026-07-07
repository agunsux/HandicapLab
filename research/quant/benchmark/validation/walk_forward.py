import pandas as pd
from typing import Generator, Tuple

def walk_forward_split(df: pd.DataFrame, start_train_year: int = 2014, initial_train_years: int = 5) -> Generator[Tuple[pd.DataFrame, pd.DataFrame], None, None]:
    """
    Generates train/test splits ensuring NO future information leaks.
    
    Example: 
    Train: 2014-2018 -> Test: 2019
    Train: 2014-2019 -> Test: 2020
    """
    if 'date' not in df.columns:
        raise ValueError("DataFrame must contain 'date' column for walk-forward validation.")
        
    df['date_parsed'] = pd.to_datetime(df['date'])
    df['year'] = df['date_parsed'].dt.year
    
    min_year = df['year'].min()
    max_year = df['year'].max()
    
    # Allow user override, but ensure we don't start before our data
    start_train_year = max(start_train_year, min_year)
    
    current_train_end = start_train_year + initial_train_years - 1
    
    while current_train_end < max_year:
        test_year = current_train_end + 1
        
        train_df = df[(df['year'] >= start_train_year) & (df['year'] <= current_train_end)].copy()
        test_df = df[df['year'] == test_year].copy()
        
        # Verify Leakage Security dynamically
        if not train_df.empty and not test_df.empty:
            assert train_df['date_parsed'].max() < test_df['date_parsed'].min(), "CRITICAL: Walk-forward leakage detected. Train data overlaps with Test data!"
            
            # Clean up temp columns before yielding
            yield (
                train_df.drop(columns=['date_parsed', 'year']), 
                test_df.drop(columns=['date_parsed', 'year'])
            )
            
        current_train_end += 1
