import numpy as np
import pandas as pd
from typing import Iterator, Tuple

class WalkForwardValidation:
    """
    Walk-Forward Validation (v2).
    Simulates production deployment by expanding or rolling the training window forward in time.
    """
    
    def __init__(self, start_date: str, step_days: int = 30, expanding: bool = True, window_days: int = 365):
        self.start_date = pd.to_datetime(start_date)
        self.step_days = pd.Timedelta(days=step_days)
        self.expanding = expanding
        self.window_days = pd.Timedelta(days=window_days)
        
    def split(self, df: pd.DataFrame, time_col: str) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
        """
        Yields train and test indices simulating rolling production.
        """
        df = df.sort_values(by=time_col).reset_index(drop=True)
        times = df[time_col]
        indices = np.arange(len(df))
        
        current_test_start = self.start_date
        max_time = times.max()
        
        while current_test_start < max_time:
            current_test_end = current_test_start + self.step_days
            
            test_indices = indices[(times >= current_test_start) & (times < current_test_end)]
            
            if self.expanding:
                train_indices = indices[times < current_test_start]
            else:
                train_start = current_test_start - self.window_days
                train_indices = indices[(times >= train_start) & (times < current_test_start)]
                
            if len(test_indices) > 0 and len(train_indices) > 0:
                yield train_indices, test_indices
                
            current_test_start = current_test_end
