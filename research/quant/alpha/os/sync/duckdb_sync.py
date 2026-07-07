import duckdb
import yaml
from pathlib import Path
import json

class DuckDBSyncEngine:
    """
    Consumes validated YAML files from the Knowledge Layer and pushes 
    them into DuckDB relational tables (Analytics Layer).
    """
    
    def __init__(self, db_path: str = "memory"):
        self.conn = duckdb.connect(db_path)
        self._init_schema()
        
    def _init_schema(self):
        # Create base tables
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS alphas (
                alpha_id VARCHAR PRIMARY KEY,
                name VARCHAR,
                status VARCHAR,
                owner VARCHAR,
                reviewer VARCHAR,
                sample_size BIGINT,
                roi DOUBLE,
                clv DOUBLE,
                brier DOUBLE,
                p_value DOUBLE,
                evidence_level VARCHAR,
                replication_score DOUBLE,
                depends_on JSON,
                produces JSON
            )
        """)
        
    def sync_alpha(self, yaml_path: str):
        with open(yaml_path, 'r') as f:
            data = yaml.safe_load(f)
            
        metrics = data.get('metrics', {})
        
        # Prepare JSON fields for DAG dependencies
        depends_on_json = json.dumps(data.get('depends_on', []))
        produces_json = json.dumps(data.get('produces', []))
        
        # Upsert logic (DuckDB supports ON CONFLICT)
        self.conn.execute("""
            INSERT INTO alphas (
                alpha_id, name, status, owner, reviewer, 
                sample_size, roi, clv, brier, p_value,
                evidence_level, replication_score, depends_on, produces
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (alpha_id) DO UPDATE SET
                name = excluded.name,
                status = excluded.status,
                roi = excluded.roi,
                clv = excluded.clv,
                brier = excluded.brier,
                p_value = excluded.p_value,
                evidence_level = excluded.evidence_level,
                replication_score = excluded.replication_score,
                depends_on = excluded.depends_on,
                produces = excluded.produces
        """, (
            data['alpha_id'], data['name'], data['status'], data['owner'], data['reviewer'],
            metrics.get('sample_size'), metrics.get('roi'), metrics.get('clv'),
            metrics.get('brier'), metrics.get('p_value'),
            data.get('evidence_level'), data.get('replication_score'),
            depends_on_json, produces_json
        ))
        
        print(f"Successfully synced Alpha {data['alpha_id']} to DuckDB.")

if __name__ == "__main__":
    engine = DuckDBSyncEngine()
    test_path = Path(__file__).parent.parent / "knowledge" / "alpha" / "template_alpha.yaml"
    engine.sync_alpha(str(test_path))
    
    # Verify Sync
    res = engine.conn.execute("SELECT alpha_id, status, roi FROM alphas").fetchall()
    print("DuckDB State:", res)
