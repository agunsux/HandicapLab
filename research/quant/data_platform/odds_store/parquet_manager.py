import duckdb
import pandas as pd
from pathlib import Path

class ParquetManager:
    """
    Manages the writing and reading of Parquet files to/from the Data Lake.
    Enforces zstd compression, dictionary encoding, and hierarchical partitioning.
    DuckDB is used strictly as the execution engine to write the Parquet assets.
    """
    def __init__(self, lake_root: str = "data_lake"):
        self.lake_root = Path(lake_root)
        
    def write_canonical_partition(self, df: pd.DataFrame, sport: str, league: str, season: str, year: int, month: int):
        """
        Writes data to the Canonical Data Lake using DuckDB.
        Enforces:
        - zstd compression
        - partitioning structure: sport/league/season/year/month
        """
        if df.empty:
            return
            
        partition_dir = self.lake_root / "canonical" / f"sport={sport}" / f"league={league}" / f"season={season}" / f"year={year}" / f"month={month:02d}"
        partition_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = partition_dir / "data.parquet"
        
        # Use DuckDB to write the dataframe directly to parquet with optimized settings
        con = duckdb.connect(database=':memory:')
        # Note: We register the dataframe so DuckDB can query it
        con.register('df_view', df)
        
        # Write to parquet with zstd compression
        # We don't use DuckDB's internal partition_by here because we are explicitly handling the folder structure 
        # to ensure it strictly matches the user's requirement without relying on DuckDB's hidden state.
        query = f"""
            COPY (SELECT * FROM df_view) TO '{file_path}' (FORMAT PARQUET, COMPRESSION 'ZSTD');
        """
        con.execute(query)
        con.close()

    def query_canonical(self, sport: str = None, league: str = None, season: str = None) -> duckdb.DuckDBPyConnection:
        """
        Returns a DuckDB connection with a view over the requested canonical data lake partitions.
        DuckDB is used purely as an analytical query engine over the Parquet files.
        """
        con = duckdb.connect(database=':memory:')
        
        # Construct path with wildcards for missing filters
        p_sport = sport if sport else "*"
        p_league = league if league else "*"
        p_season = season if season else "*"
        
        glob_path = self.lake_root / "canonical" / f"sport={p_sport}" / f"league={p_league}" / f"season={p_season}" / "*" / "*" / "*.parquet"
        
        # Create a view across the partitioned parquet files
        # DuckDB automatically infers Hive-style partitioning (sport=..., league=...)
        query = f"""
            CREATE OR REPLACE VIEW canonical_matches AS 
            SELECT * FROM read_parquet('{glob_path}', hive_partitioning=true);
        """
        try:
            con.execute(query)
        except Exception as e:
            # If path doesn't exist yet, just create an empty view or fail gracefully
            pass
            
        return con
