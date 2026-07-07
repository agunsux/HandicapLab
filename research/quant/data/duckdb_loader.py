import duckdb
import pandas as pd
from pathlib import Path

def load_canonical_data(base_path: str = "../../data/silver") -> pd.DataFrame:
    """
    Load all canonical parquet partitions from the Silver layer into a Pandas DataFrame.
    """
    path = Path(base_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Data path not found: {base_path}")
        
    # DuckDB can read multiple parquet files using a glob pattern
    query = f"""
        SELECT *
        FROM read_parquet('{str(path.absolute().as_posix())}/*/*/*/dataset.parquet', union_by_name=True)
    """
    
    # Establish an in-memory duckdb connection
    con = duckdb.connect(database=':memory:')
    
    try:
        df = con.execute(query).df()
        # Clean string columns and handle timestamps
        if 'available_at' in df.columns:
            df['available_at'] = pd.to_datetime(df['available_at'])
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
        if 'kickoff' in df.columns:
            df['kickoff'] = pd.to_datetime(df['kickoff'])
            
        # --- FAIL-FAST VALIDATIONS ---
        # 1. No unplayed, postponed, or live matches
        if 'status' in df.columns:
            pre_count = len(df)
            df = df[df['status'] == 'FINISHED']
            post_count = len(df)
            if pre_count != post_count:
                print(f"Data Filter: Removed {pre_count - post_count} non-finished matches.")
                
        # 2. No null targets
        if 'home_goals' in df.columns and 'away_goals' in df.columns:
            if df['home_goals'].isnull().any() or df['away_goals'].isnull().any():
                raise ValueError("FAIL-FAST: Found NULL values in target columns (home_goals/away_goals).")
                
        # Basic sanity checks
        if df.empty:
            print("Warning: Loaded dataset is empty.")
            
        # Drop duplicates
        if 'match_id' in df.columns:
            df = df.drop_duplicates(subset=['match_id'])
            
        # Compute Dataset Metadata and Hash
        import hashlib
        # Hash pandas object is fast and deterministic for same data
        hash_val = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
        
        df.attrs['metadata'] = {
            "row_count": len(df),
            "league_count": df['competition_id'].nunique() if 'competition_id' in df.columns else 1,
            "season_min": df['season'].min() if 'season' in df.columns else None,
            "season_max": df['season'].max() if 'season' in df.columns else None,
            "dataset_hash": hash_val
        }
            
        return df
    finally:
        con.close()

if __name__ == "__main__":
    df = load_canonical_data()
    print(f"Loaded {len(df)} rows from canonical feature store.")
    print(df.head())
