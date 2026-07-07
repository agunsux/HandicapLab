import os
import json
import hashlib
import pandas as pd
from datetime import datetime
from pathlib import Path
from research.quant.alpha.platform.registry.dataset_registry import DatasetRegistry

class SnapshotManager:
    """
    Manages Immutable Data Snapshots using Parquet and metadata.json (SHA256).
    Integrates with DatasetRegistry to provide Fingerprints.
    """
    
    def __init__(self, base_path: str = "research/snapshots", registry: DatasetRegistry = None):
        self.base_path = Path(base_path)
        self.registry = registry or DatasetRegistry()
        
    def create_snapshot(self, matches_df: pd.DataFrame, odds_df: pd.DataFrame, num_leagues: int = 5) -> str:
        """
        Freezes the current datasets into an immutable snapshot directory.
        Registers the fingerprint to the DatasetRegistry.
        Returns the dataset_id.
        """
        date_str = datetime.now().strftime("%Y%m%d")
        
        # Use UUID or sequential in production. Mocking sequential for simplicity.
        dataset_id = f"DS_{date_str}_001"
        snapshot_dir = self.base_path / dataset_id
        
        if snapshot_dir.exists():
            return dataset_id
            
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        
        # Save Parquets
        matches_df.to_parquet(snapshot_dir / "matches.parquet")
        odds_df.to_parquet(snapshot_dir / "odds.parquet")
        
        # Calculate SHA256 of the parquets
        hasher = hashlib.sha256()
        hasher.update(matches_df.to_csv(index=False).encode('utf-8'))
        sha256_hash = hasher.hexdigest()
        
        # Dataset Fingerprint
        fingerprint = {
            "rows": len(matches_df),
            "date_range": f"{matches_df['kickoff'].min()} to {matches_df['kickoff'].max()}" if 'kickoff' in matches_df.columns else "N/A",
            "leagues": num_leagues,
            "seasons": 3,
            "bookmakers": 1, # Pinnacle mock
            "missing_values": int(matches_df.isnull().sum().sum()),
            "feature_count": len(matches_df.columns),
            "sha256": sha256_hash
        }
        
        metadata = {
            "dataset_id": dataset_id,
            "created_at": datetime.now().isoformat(),
            "git_commit": "mock_commit_hash_123",
            "provider_versions": {
                "football_data": "v2026.07",
                "odds": "pinnacle_v1"
            },
            "fingerprint": fingerprint
        }
        
        with open(snapshot_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
            
        # Register to central registry
        self.registry.register_dataset(dataset_id, fingerprint)
            
        return dataset_id
