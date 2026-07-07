import pandas as pd
import numpy as np
from typing import List

class LeakageDetector:
    """
    Detects Target Leakage, Future Leakage, and Post-Event Information in datasets.
    Raises errors if leakage is detected to instantly fail the experiment.
    """
    
    @staticmethod
    def check_target_leakage(df: pd.DataFrame, features: List[str], target: str, threshold: float = 0.99):
        """
        Checks if any feature has a near-perfect correlation with the target.
        """
        if df.empty or target not in df.columns:
            return
            
        for feat in features:
            if feat not in df.columns:
                continue
                
            # Quick correlation check (only for numerical columns)
            if pd.api.types.is_numeric_dtype(df[feat]) and pd.api.types.is_numeric_dtype(df[target]):
                corr = np.abs(df[feat].corr(df[target]))
                if corr > threshold:
                    raise ValueError(f"TARGET LEAKAGE DETECTED: Feature '{feat}' has {corr:.2f} correlation with target '{target}'.")
                    
    @staticmethod
    def check_future_leakage(df: pd.DataFrame, observation_timestamp_col: str = 'timestamp', event_timestamp_col: str = 'kickoff_utc'):
        """
        Ensures no observation timestamp occurs after the event timestamp (if predicting pre-match).
        """
        if df.empty:
            return
            
        future_leaks = df[df[observation_timestamp_col] >= df[event_timestamp_col]]
        if not future_leaks.empty:
            raise ValueError(f"FUTURE LEAKAGE DETECTED: {len(future_leaks)} rows have observations on or after kickoff.")

    @staticmethod
    def check_post_event_features(df: pd.DataFrame, post_event_cols: List[str]):
        """
        Ensures no known post-match columns (like full_time_score, goals_home) are present in the training set.
        """
        leaked_cols = [col for col in post_event_cols if col in df.columns]
        if leaked_cols:
            raise ValueError(f"POST-EVENT LEAKAGE DETECTED: Dataset contains forbidden columns: {leaked_cols}")
