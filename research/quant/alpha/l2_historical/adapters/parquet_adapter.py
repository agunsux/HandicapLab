import pandas as pd
from research.quant.alpha.l2_historical.adapters.base_adapter import BaseAdapter

class ParquetAdapter(BaseAdapter):
    """
    Adapter for loading historical Parquet snapshots.
    """
    
    def load_data(self, source_path: str, **kwargs) -> pd.DataFrame:
        # Implementation assumes the parquet file is already close to the contract format.
        # A real implementation would map specific columns from 'odds feed A' to the canonical schema.
        df = pd.read_parquet(source_path, **kwargs)
        
        # Ensure datetime parsing if not native
        if 'kickoff_utc' in df.columns and not pd.api.types.is_datetime64_any_dtype(df['kickoff_utc']):
            df['kickoff_utc'] = pd.to_datetime(df['kickoff_utc'], utc=True)
            
        if 'timestamp' in df.columns and not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
            df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
            
        return df
