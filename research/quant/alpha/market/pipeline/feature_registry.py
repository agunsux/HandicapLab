import yaml
import duckdb
from typing import Dict, Any, List
import json
from pathlib import Path

class FeatureRegistry:
    """
    Hybrid Feature Registry.
    YAML acts as the Source of Truth (metadata).
    DuckDB acts as Operational Analytics (profiling, usage, performance).
    """
    def __init__(self, db_path: str = "feature_store.db", yaml_path: str = "feature_registry.yaml"):
        # Resolve paths relative to the current file
        base_dir = Path(__file__).parent
        self.yaml_path = base_dir / yaml_path
        self.db_path = base_dir / db_path
        
        self.conn = duckdb.connect(str(self.db_path))
        self._init_schema()

    def _init_schema(self):
        # Table for metadata synced from YAML
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS feature_meta (
                name VARCHAR PRIMARY KEY,
                description VARCHAR,
                owner VARCHAR,
                formula VARCHAR,
                tags JSON,
                version VARCHAR,
                status VARCHAR,
                dependencies JSON
            )
        """)
        # Table for operational analytics (updated by jobs)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS feature_profile (
                name VARCHAR PRIMARY KEY,
                missing_rate DOUBLE,
                importance_score DOUBLE,
                usage_count INTEGER DEFAULT 0,
                last_experiment_ts TIMESTAMP
            )
        """)
        
    def sync_from_yaml(self):
        """
        Syncs metadata from the YAML source of truth to DuckDB.
        """
        if not self.yaml_path.exists():
            return
            
        with open(self.yaml_path, 'r') as f:
            data = yaml.safe_load(f) or {}
            
        features = data.get("features", [])
        for feat in features:
            tags_json = json.dumps(feat.get("tags", []))
            deps_json = json.dumps(feat.get("dependencies", []))
            
            self.conn.execute("""
                INSERT INTO feature_meta (
                    name, description, owner, formula, tags, version, status, dependencies
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (name) DO UPDATE SET
                    description = excluded.description,
                    owner = excluded.owner,
                    formula = excluded.formula,
                    tags = excluded.tags,
                    version = excluded.version,
                    status = excluded.status,
                    dependencies = excluded.dependencies
            """, (
                feat['name'], feat.get('description'), feat.get('owner'), 
                feat.get('formula'), tags_json, feat.get('version'), 
                feat.get('status'), deps_json
            ))

    def update_profile(self, name: str, missing_rate: float, importance_score: float):
        """
        Updates the operational analytics for a feature.
        """
        self.conn.execute("""
            INSERT INTO feature_profile (name, missing_rate, importance_score, usage_count, last_experiment_ts)
            VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (name) DO UPDATE SET
                missing_rate = excluded.missing_rate,
                importance_score = excluded.importance_score,
                usage_count = feature_profile.usage_count + 1,
                last_experiment_ts = CURRENT_TIMESTAMP
        """, (name, missing_rate, importance_score))
