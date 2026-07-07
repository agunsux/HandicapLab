import pandas as pd
from pathlib import Path
import os

def save_to_feature_store(df: pd.DataFrame, silver_dir: str):
    """
    Saves a Canonical Dataframe into Silver using Hive-partitioning:
    silver_dir / league_id=... / season=... / data.parquet
    """
    if df.empty:
        return
        
    base_path = Path(silver_dir)
    
    # We partition by league_id and season.
    # To do this safely with pandas, we can iterate over the groups.
    # Alternatively, PyArrow supports this natively, but we'll use pandas directly.
    
    # Ensure required columns exist
    if 'league_id' not in df.columns or 'season' not in df.columns:
        print("[STORE] WARNING: Missing partitioning columns (league_id, season). Saving to root.")
        out_file = base_path / "unpartitioned_data.parquet"
        df.to_parquet(out_file, index=False)
        return
        
    for (league, season), group in df.groupby(['league_id', 'season']):
        part_dir = base_path / f"league_id={league}" / f"season={season}"
        part_dir.mkdir(parents=True, exist_ok=True)
        
        out_file = part_dir / "data.parquet"
        
        # If the file already exists, we must merge and deduplicate
        if out_file.exists():
            existing_df = pd.read_parquet(out_file)
            merged_df = pd.concat([existing_df, group], ignore_index=True)
            # Deduplicate keeping the latest
            merged_df = merged_df.drop_duplicates(subset=['match_uuid'], keep='last')
            merged_df.to_parquet(out_file, index=False)
        else:
            group.to_parquet(out_file, index=False)
            
    print(f"[STORE] Successfully saved/merged {len(df)} canonical records to Silver (Hive Partitioned).")
