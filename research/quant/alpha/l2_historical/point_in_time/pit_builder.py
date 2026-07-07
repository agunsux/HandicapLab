import pandas as pd
from datetime import timedelta

class PointInTimeBuilder:
    """
    Prevents Look-Ahead Bias by slicing the dataset exactly at a specified cutoff time T.
    Any data point with timestamp > T is strictly removed.
    """
    
    @staticmethod
    def build_snapshot(df: pd.DataFrame, time_before_kickoff: timedelta) -> pd.DataFrame:
        """
        Builds a dataset snapshot where we only see odds available up to 
        `time_before_kickoff` before the match starts.
        
        Example: If time_before_kickoff = timedelta(hours=1), we only keep odds 
        recorded at least 1 hour before kickoff_utc.
        """
        # Calculate the absolute cutoff time for each match
        cutoff_time = df['kickoff_utc'] - time_before_kickoff
        
        # Filter out anything that happened after the cutoff time
        snapshot_df = df[df['timestamp'] <= cutoff_time].copy()
        
        return snapshot_df
        
    @staticmethod
    def build_absolute_snapshot(df: pd.DataFrame, cutoff_utc: pd.Timestamp) -> pd.DataFrame:
        """
        Slices the entire dataset at an absolute UTC timestamp.
        """
        return df[df['timestamp'] <= cutoff_utc].copy()
