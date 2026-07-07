import pandas as pd
from datetime import datetime, timedelta
import os
import shutil
from research.quant.data_platform.odds_store.parquet_manager import ParquetManager
from research.quant.data_platform.builder.dataset_builder import DatasetBuilder
from research.quant.data_platform.catalog.data_catalog import DataCatalog

def test_data_platform_e2e():
    """
    Tests the Data Asset Foundation (DuckDB + Parquet).
    - Creates partitioned canonical data using ParquetManager
    - Builds an immutable dataset version using DatasetBuilder with 6h horizon
    - Generates a Data Catalog report
    """
    
    # 1. Setup mock Canonical Data Lake
    lake_root = "test_data_lake"
    if os.path.exists(lake_root):
        shutil.rmtree(lake_root)
        
    pm = ParquetManager(lake_root=lake_root)
    
    # Create mock tick-by-tick odds data
    kickoff = datetime.utcnow() + timedelta(days=1)
    df_mock = pd.DataFrame({
        'canonical_uuid': ['m1', 'm1', 'm2'],
        'league': ['EPL', 'EPL', 'La_Liga'],
        'season': ['2023_2024', '2023_2024', '2023_2024'],
        'kickoff_utc': [kickoff, kickoff, kickoff],
        'timestamp': [
            kickoff - timedelta(hours=24), 
            kickoff - timedelta(hours=2), # Inside the 6h horizon (too late)
            kickoff - timedelta(hours=10)
        ],
        'odds': [1.95, 1.90, 2.10]
    })
    
    # Write partitions simulating append
    pm.write_canonical_partition(df_mock[df_mock['league']=='EPL'], "football", "EPL", "2023_2024", 2023, 8)
    pm.write_canonical_partition(df_mock[df_mock['league']=='La_Liga'], "football", "La_Liga", "2023_2024", 2023, 8)
    print("Partitioned Parquet written successfully with DuckDB.")
    
    # 2. Dataset Builder (6h horizon)
    builder = DatasetBuilder(lake_root=lake_root)
    
    # This should drop the second row (timestamp 2 hours before kickoff) 
    # because the horizon is 6 hours before kickoff.
    builder.build_dataset("test_alpha_dataset", leagues=["EPL", "La_Liga"], seasons=["2023_2024"], horizon_key="6h")
    
    # Check if v001 was created
    assert os.path.exists(os.path.join(lake_root, "research", "test_alpha_dataset", "v001.parquet"))
    
    # Validate the data inside v001
    df_v1 = pd.read_parquet(os.path.join(lake_root, "research", "test_alpha_dataset", "v001.parquet"))
    assert len(df_v1) == 2, f"Expected 2 rows after 6h horizon filter, got {len(df_v1)}"
    
    # Build again to prove immutability (creates v002)
    builder.build_dataset("test_alpha_dataset", leagues=["EPL"], seasons=["2023_2024"], horizon_key="6h")
    assert os.path.exists(os.path.join(lake_root, "research", "test_alpha_dataset", "v002.parquet"))
    
    # 3. Data Catalog
    catalog = DataCatalog(lake_root=lake_root)
    report = catalog.generate_catalog_report()
    
    print("\n" + report)
    print("\nTest Passed: Data Asset Foundation (DuckDB + Parquet zstd) with Horizons is functional.")
    
    # Cleanup
    if os.path.exists(lake_root):
        shutil.rmtree(lake_root)

if __name__ == "__main__":
    test_data_platform_e2e()
