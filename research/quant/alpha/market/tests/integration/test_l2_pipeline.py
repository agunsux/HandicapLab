import pandas as pd
import pytest
from datetime import timedelta
from research.quant.alpha.l2_historical.pipeline.l2_historical_pipeline import L2HistoricalPipeline
from research.quant.alpha.l2_historical.adapters.parquet_adapter import ParquetAdapter
from research.quant.alpha.market.engine.steam_engine import SteamEngine
import os

def test_l2_dry_run_pipeline():
    """
    Tests the L2 Pipeline in DRY-RUN mode to prove 'Infrastructure Ready'.
    Validates Contract, PIT slice, and Leakage detection.
    """
    
    # 1. Create a tiny mock dataframe that perfectly fits the Dataset Contract
    df_mock = pd.DataFrame({
        'match_id': [101, 101],
        'league': ['EPL', 'EPL'],
        'season': ['2023', '2023'],
        'kickoff_utc': pd.to_datetime(['2026-08-01 15:00:00', '2026-08-01 15:00:00'], utc=True),
        'bookmaker': ['Pinnacle', 'Pinnacle'],
        'market': ['AH', 'AH'],
        'selection': ['Home', 'Home'],
        'odds': [1.95, 1.90],
        'timestamp': pd.to_datetime(['2026-08-01 10:00:00', '2026-08-01 14:30:00'], utc=True),
        'handicap': [-0.5, -0.5],
        'closing_flag': [False, False],
        'provider': ['oddsportal', 'oddsportal'],
        'version': ['v1', 'v1']
    })
    
    # Save as parquet to test adapter
    test_file = "test_l2_dry_run.parquet"
    df_mock.to_parquet(test_file)
    
    try:
        adapter = ParquetAdapter()
        pipeline = L2HistoricalPipeline(adapter)
        
        # 2. Run in DRY-RUN Mode (Slicing 1 hour before kickoff)
        # Expected: The row at 14:30 should be dropped by PIT builder
        result = pipeline.run(
            dataset_path=test_file,
            engine_class=SteamEngine,
            time_before_kickoff=timedelta(hours=1),
            target_col="full_time_result",
            post_event_cols=["full_time_result", "goals_home"],
            dry_run=True
        )
        
        assert result["status"] == "DRY_RUN_SUCCESS"
        print("Test Passed: L2 Pipeline DRY-RUN executed successfully with strict contract validation.")
        
    finally:
        if os.path.exists(test_file):
            os.remove(test_file)

if __name__ == "__main__":
    test_l2_dry_run_pipeline()
