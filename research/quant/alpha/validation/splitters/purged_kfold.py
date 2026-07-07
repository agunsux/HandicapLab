import numpy as np
import pandas as pd
from typing import Iterator, Tuple

class PurgedKFold:
    """
    Purged K-Fold Cross Validation.
    Removes training samples that overlap in time with testing samples (Purge).
    Adds a gap after the testing period to prevent future correlation leakage (Embargo).
    """
    
    def __init__(self, n_splits: int = 5, purge_window: pd.Timedelta = pd.Timedelta(days=1), embargo_window: pd.Timedelta = pd.Timedelta(days=1)):
        self.n_splits = n_splits
        self.purge_window = purge_window
        self.embargo_window = embargo_window
        
    def split(self, df: pd.DataFrame, time_col: str) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
        """
        Yields train and test indices for each fold.
        """
        # Sort by time
        df = df.sort_values(by=time_col).reset_index(drop=True)
        times = df[time_col]
        indices = np.arange(len(df))
        
        # Determine split boundaries based on quantiles of time
        t_min, t_max = times.min(), times.max()
        fold_bounds = pd.date_range(start=t_min, end=t_max, periods=self.n_splits + 1)
        
        for i in range(self.n_splits):
            test_start = fold_bounds[i]
            test_end = fold_bounds[i+1]
            
            # Test indices
            test_indices = indices[(times >= test_start) & (times < test_end)]
            
            # Train indices: everything except test + purge/embargo
            # Before test: purge window
            train_before = indices[times < (test_start - self.purge_window)]
            
            # After test: embargo window
            train_after = indices[times >= (test_end + self.embargo_window)]
            
            train_indices = np.concatenate([train_before, train_after])
            
            yield train_indices, test_indices
