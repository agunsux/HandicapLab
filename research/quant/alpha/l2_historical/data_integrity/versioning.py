import pandas as pd
from typing import Dict, Any

class DatasetVersioning:
    """
    Extracts metadata from a dataset to ensure traceability (Date Range, Coverage, Bookmakers).
    """
    
    @staticmethod
    def extract_metadata(df: pd.DataFrame, dataset_id: str, fingerprint: str) -> Dict[str, Any]:
        if df.empty:
            return {}
            
        return {
            "dataset_id": dataset_id,
            "fingerprint": fingerprint,
            "date_start": str(df['kickoff_utc'].min()),
            "date_end": str(df['kickoff_utc'].max()),
            "leagues_covered": int(df['league'].nunique()) if 'league' in df.columns else 0,
            "bookmakers_covered": int(df['bookmaker'].nunique()) if 'bookmaker' in df.columns else 0
        }
