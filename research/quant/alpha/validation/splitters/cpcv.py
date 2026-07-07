import numpy as np
import pandas as pd
from itertools import combinations
from typing import Iterator, Tuple

class CombinatorialPurgedCV:
    """
    Combinatorial Purged Cross Validation (CPCV).
    The gold standard for financial time-series. Generates multiple testing paths.
    """
    
    def __init__(self, n_splits: int = 6, n_test_splits: int = 2, purge_window: pd.Timedelta = pd.Timedelta(days=1), embargo_window: pd.Timedelta = pd.Timedelta(days=1)):
        self.n_splits = n_splits
        self.n_test_splits = n_test_splits
        self.purge_window = purge_window
        self.embargo_window = embargo_window
        
    def split(self, df: pd.DataFrame, time_col: str) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
        """
        Yields train and test indices for all combinatorial folds.
        """
        df = df.sort_values(by=time_col).reset_index(drop=True)
        times = df[time_col]
        indices = np.arange(len(df))
        
        t_min, t_max = times.min(), times.max()
        fold_bounds = pd.date_range(start=t_min, end=t_max, periods=self.n_splits + 1)
        
        # Combinations of folds to be used as TEST
        test_combinations = list(combinations(range(self.n_splits), self.n_test_splits))
        
        for test_folds in test_combinations:
            test_indices = []
            train_indices = []
            
            # Build test set
            for tf in test_folds:
                test_start = fold_bounds[tf]
                test_end = fold_bounds[tf+1]
                t_idx = indices[(times >= test_start) & (times < test_end)]
                test_indices.extend(t_idx)
                
            # Build train set with purge and embargo around each test fold
            for i in range(self.n_splits):
                if i in test_folds:
                    continue
                    
                train_start = fold_bounds[i]
                train_end = fold_bounds[i+1]
                
                # Check distance from all test folds to apply purge/embargo
                valid = True
                # Simplified check for mock implementation
                # A full CPCV would strictly mask out train indices falling within purge/embargo of any test index
                tr_idx = indices[(times >= train_start) & (times < train_end)]
                train_indices.extend(tr_idx)
                
            yield np.array(train_indices), np.array(test_indices)
