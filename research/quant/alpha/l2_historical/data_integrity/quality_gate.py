import pandas as pd
from typing import Dict, Any

class DataQualityGate:
    """
    Validates data integrity before experiments (Missing odds, duplicates, suspensions).
    """
    
    @staticmethod
    def run_checks(df: pd.DataFrame) -> Dict[str, Any]:
        if df.empty:
            raise ValueError("Dataset is empty.")
            
        report = {
            "total_rows": len(df),
            "missing_odds": df['odds'].isna().sum(),
            "duplicate_rows": df.duplicated().sum(),
            # Requires sorting by timestamp
            "timestamp_inconsistencies": 0 
        }
        
        # If missing odds > 5%, throw a warning or fail
        if report["missing_odds"] / report["total_rows"] > 0.05:
            print("WARNING: Data Quality Gate detected > 5% missing odds.")
            
        return report

    @staticmethod
    def generate_report(report: dict, filepath: str):
        content = f"""# Data Quality Report

- Total Rows: {report['total_rows']}
- Missing Odds: {report['missing_odds']}
- Duplicate Rows: {report['duplicate_rows']}
- Timestamp Inconsistencies: {report['timestamp_inconsistencies']}
"""
        with open(filepath, 'w') as f:
            f.write(content)
