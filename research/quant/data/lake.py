import os
import hashlib
import json
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime
import pandas as pd
from pathlib import Path

class MarketDataLake:
    """
    Handles Parquet ZSTD storage and Lineage tracking for the Market Data Lakehouse.
    """
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.layers = ['raw', 'staging', 'curated', 'feature_store', 'research']
        self._ensure_directories()
        
    def _ensure_directories(self):
        for layer in self.layers:
            (self.base_path / layer).mkdir(parents=True, exist_ok=True)
            
    def _generate_fingerprint(self, df: pd.DataFrame, metadata: dict) -> str:
        """
        Generates a SHA256 fingerprint based on schema, row count, and metadata.
        """
        schema_str = str(df.dtypes.to_dict())
        stats_str = f"rows:{len(df)}"
        meta_str = json.dumps(metadata, sort_keys=True)
        
        fingerprint_content = f"{schema_str}|{stats_str}|{meta_str}"
        return hashlib.sha256(fingerprint_content.encode('utf-8')).hexdigest()

    def write_dataset(self, 
                      df: pd.DataFrame, 
                      layer: str, 
                      dataset_id: str,
                      provider: str,
                      league: str,
                      season: str,
                      market: str,
                      parser_version: str = "1.0",
                      schema_version: str = "v1"):
        """
        Writes a dataset to the lakehouse in ZSTD Parquet format with partition structure.
        """
        if layer not in self.layers:
            raise ValueError(f"Invalid layer: {layer}. Must be one of {self.layers}")
            
        # Add Lineage Columns if staging or above
        if layer != 'raw':
            df['ingest_timestamp'] = datetime.utcnow().isoformat()
            df['parser_version'] = parser_version
            df['schema_version'] = schema_version
            df['provider_source'] = provider
            
        metadata = {
            "dataset_id": dataset_id,
            "provider": provider,
            "league": league,
            "season": season,
            "market": market,
            "schema_version": schema_version
        }
        
        fingerprint = self._generate_fingerprint(df, metadata)
        df['dataset_fingerprint'] = fingerprint
        
        # Partition path: provider/league/season/market
        partition_path = self.base_path / layer / provider / league / season / market
        partition_path.mkdir(parents=True, exist_ok=True)
        
        file_path = partition_path / f"{dataset_id}.parquet"
        
        table = pa.Table.from_pandas(df)
        
        # Write Parquet with ZSTD compression
        pq.write_table(table, file_path, compression='ZSTD')
        
        return fingerprint, file_path

    def read_dataset(self, path: str) -> pd.DataFrame:
        """
        Final Rule: Models never read from 'raw'.
        """
        if 'raw' in Path(path).parts:
            raise PermissionError("CRITICAL: Models and analytical queries are strictly forbidden from reading the 'raw' layer.")
            
        return pd.read_parquet(path)
