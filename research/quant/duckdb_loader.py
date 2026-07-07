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
            
        # Basic sanity checks
        if df.empty:
            print("Warning: Loaded dataset is empty.")
            
        # Drop duplicates just in case (though dataset builder enforces it)
        if 'match_id' in df.columns:
            df = df.drop_duplicates(subset=['match_id'])
            
        return df
    finally:
        con.close()

if __name__ == "__main__":
    df = load_canonical_data()
    print(f"Loaded {len(df)} rows from canonical feature store.")
    print(df.head())
