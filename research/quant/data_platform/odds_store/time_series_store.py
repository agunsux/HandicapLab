import pandas as pd
from pathlib import Path
from research.quant.data_platform.odds_store.parquet_manager import ParquetManager

class TimeSeriesOddsStore:
    """
    Append-only store for historical tick-by-tick odds.
    """
    def __init__(self, manager: ParquetManager):
        self.manager = manager
        
    def append_ticks(self, df: pd.DataFrame, sport: str, league: str, season: str, year: int, month: int):
        """
        Appends new odds ticks to the Canonical Data Lake.
        Forces strict metadata presence as requested by the user.
        """
        required_metadata = [
            "ingestion_timestamp", 
            "provider_timestamp", 
            "receive_latency", 
            "source", 
            "revision_number"
        ]
        
        missing = [col for col in required_metadata if col not in df.columns]
        if missing:
            raise ValueError(f"Cannot append to Time-Series Store. Missing required metadata: {missing}")
            
        # ParquetManager handles the partitioning (sport/league/season/year/month) and compression
        self.manager.write_canonical_partition(df, sport, league, season, year, month)
