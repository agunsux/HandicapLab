import pandas as pd

class DataLeakageError(Exception):
    pass

def validate_feature_timestamps(df: pd.DataFrame):
    """
    Validates that no features are leaking information from the future.
    Ensures that for every row: source_timestamp <= kickoff
    If source_timestamp is missing, we log a warning but allow for now
    until the feature store enforces it.
    """
    if 'kickoff' not in df.columns:
        return
        
    if 'source_timestamp' in df.columns:
        # Check for leakage
        leaks = df[df['source_timestamp'] > df['kickoff']]
        if len(leaks) > 0:
            raise DataLeakageError(f"FAIL-FAST: {len(leaks)} rows have source_timestamp > kickoff. Data Leakage detected!")
    else:
        print("Warning: 'source_timestamp' column not found. Skipping strict timestamp validation.")
