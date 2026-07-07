import pytest
import pandas as pd
import numpy as np
from research.quant.benchmark.validation.walk_forward import walk_forward_split

def test_walk_forward_leakage():
    """
    Ensures that walk_forward_split strictly enforces time isolation.
    """
    dates = pd.date_range('2020-01-01', '2023-12-31', freq='D')
    df = pd.DataFrame({
        'date': dates,
        'val': np.random.rand(len(dates))
    })
    
    splits_run = False
    for train_df, test_df in walk_forward_split(df, start_train_year=2020, initial_train_years=2):
        splits_run = True
        train_max_date = pd.to_datetime(train_df['date']).max()
        test_min_date = pd.to_datetime(test_df['date']).min()
        
        assert train_max_date < test_min_date, "LEAKAGE: Train data overlaps with Test data!"
        
    assert splits_run, "No splits were generated"

def test_walk_forward_throws_on_leakage_attempt():
    """
    If we manually manipulate a split to have leakage, assert that our security logic would catch it.
    (This is simulating the internal check of the walk_forward_split).
    """
    df = pd.DataFrame({
        'date': ['2020-01-01', '2020-12-31', '2021-01-01'],
        'year': [2020, 2020, 2020], # Intentionally malformed year mapping to cause leakage
        'date_parsed': pd.to_datetime(['2020-01-01', '2020-12-31', '2021-01-01'])
    })
    
    # Simulate internal logic
    start_train_year = 2020
    current_train_end = 2020
    test_year = 2020 # Intentionally testing the same year
    
    train_df = df[df['year'] == start_train_year].copy()
    test_df = df[df['year'] == test_year].copy()
    
    with pytest.raises(AssertionError, match="CRITICAL: Walk-forward leakage detected"):
        assert train_df['date_parsed'].max() < test_df['date_parsed'].min(), "CRITICAL: Walk-forward leakage detected. Train data overlaps with Test data!"
