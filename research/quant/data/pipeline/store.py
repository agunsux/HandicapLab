import pandas as pd
from pathlib import Path

def save_to_feature_store(df: pd.DataFrame, silver_dir: str):
    """
    Saves the canonical dataframe to the silver layer Feature Store as Parquet.
    Partitions by league_id and season for fast querying with DuckDB.
    """
    out_path = Path(silver_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    # Check if we have the partition columns
    if 'league_id' not in df.columns or 'season' not in df.columns:
        print("Warning: Missing partition columns. Saving unpartitioned.")
        df.to_parquet(out_path / "all_matches.parquet", index=False)
        return
        
    df.to_parquet(
        out_path,
        engine='pyarrow',
        partition_cols=['league_id', 'season'],
        index=False,
        # Allow overwriting existing partitions
        existing_data_behavior='overwrite_or_ignore' 
    )
    print(f"[STORE] Successfully saved {len(df)} rows to Feature Store at {silver_dir}")
