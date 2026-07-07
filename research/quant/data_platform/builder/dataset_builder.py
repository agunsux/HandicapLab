import duckdb
import pandas as pd
from typing import List
from pathlib import Path
from datetime import timedelta

class DatasetBuilder:
    """
    Builds immutable datasets based on specific parameters and prediction horizons.
    The resulting datasets are saved to `data_lake/research/` as Parquet files.
    """
    
    HORIZONS = {
        "24h": timedelta(hours=24),
        "12h": timedelta(hours=12),
        "6h": timedelta(hours=6),
        "3h": timedelta(hours=3),
        "1h": timedelta(hours=1),
        "30m": timedelta(minutes=30),
        "10m": timedelta(minutes=10)
    }

    def __init__(self, lake_root: str = "data_lake"):
        self.lake_root = Path(lake_root)
        
    def build_dataset(self, dataset_name: str, leagues: List[str], seasons: List[str], horizon_key: str):
        """
        Queries the Canonical Time-Series Store, slices by Prediction Horizon, 
        and writes a new immutable dataset version.
        """
        if horizon_key not in self.HORIZONS:
            raise ValueError(f"Invalid horizon. Must be one of {list(self.HORIZONS.keys())}")
            
        horizon_td = self.HORIZONS[horizon_key]
        
        # Connect to DuckDB as query engine
        con = duckdb.connect(database=':memory:')
        
        # Read from partitioned Parquet files
        # In a real scenario, we would dynamically build the glob string based on `leagues` and `seasons`.
        # Here we just read the whole canonical store and filter in SQL.
        glob_path = self.lake_root / "canonical" / "*" / "*" / "*" / "*" / "*" / "*.parquet"
        
        try:
            con.execute(f"CREATE VIEW canonical_data AS SELECT * FROM read_parquet('{glob_path}', hive_partitioning=true)")
            
            # Build the query
            league_str = ",".join([f"'{l}'" for l in leagues])
            season_str = ",".join([f"'{s}'" for s in seasons])
            
            # We enforce the prediction horizon exactly as specified
            # filtering rows where timestamp is exactly at or before (kickoff - horizon)
            query = f"""
                SELECT * FROM canonical_data
                WHERE league IN ({league_str})
                  AND season IN ({season_str})
                  AND timestamp <= (kickoff_utc - INTERVAL {int(horizon_td.total_seconds())} SECONDS)
            """
            
            result_df = con.execute(query).fetchdf()
            
            # Versioning logic (v001 -> v002) -> Immutability
            research_dir = self.lake_root / "research" / dataset_name
            research_dir.mkdir(parents=True, exist_ok=True)
            
            # Find next version
            existing_versions = list(research_dir.glob("v*.parquet"))
            next_v = len(existing_versions) + 1
            out_file = research_dir / f"v{next_v:03d}.parquet"
            
            # Save the immutable snapshot
            result_df.to_parquet(out_file, compression='zstd')
            print(f"Successfully built immutable dataset: {out_file}")
            
        except Exception as e:
            print(f"Dataset build failed (maybe canonical store is empty): {e}")
        finally:
            con.close()
