import json
import hashlib
from datetime import datetime
from typing import Dict, Any, List
from pathlib import Path

class ManifestGenerator:
    """
    Generates JSON Experiment Manifests and manages the Artifact Registry.
    Incorporates the Experiment State Machine and Feature Manifests.
    """
    
    SCHEMA_VERSION = "v2.0"
    EVALUATION_PROTOCOL = "validation_protocol_v1"
    
    @staticmethod
    def generate_manifest(experiment_id: str, 
                          dataset_snapshot: str, 
                          metrics: Dict[str, float], 
                          parameters: Dict[str, Any],
                          promotion_status: str = "COMPLETED",
                          tags: List[str] = None,
                          output_dir: str = "research/artifacts") -> str:
        """
        Creates the Artifact Registry directory and saves the JSON manifest.
        """
        tags = tags or ["experimental"]
        
        # Dedicated Artifact Directory
        exp_dir = Path(output_dir) / experiment_id
        exp_dir.mkdir(parents=True, exist_ok=True)
        
        dataset_hash = hashlib.sha256(dataset_snapshot.encode('utf-8')).hexdigest()[:16]
        parameter_hash = hashlib.sha256(json.dumps(parameters, sort_keys=True).encode('utf-8')).hexdigest()[:16]
        
        # Experiment State Machine initialization
        now = datetime.now().isoformat()
        
        manifest_data = {
            "schema_version": ManifestGenerator.SCHEMA_VERSION,
            "evaluation_protocol": ManifestGenerator.EVALUATION_PROTOCOL,
            "experiment_id": experiment_id,
            "created_at": now,
            "git_commit": "mock_git_commit_abc",
            
            # State Machine
            "experiment_state": {
                "status": promotion_status,
                "updated_at": now,
                "transition_history": ["DRAFT", "RUNNING", "COMPLETED"]
            },
            
            "dataset_snapshot": dataset_snapshot,
            "research_tags": tags,
            
            # Feature Manifest
            "feature_manifest": {
                "version": "v1.0.5",
                "groups": ["elo", "rolling_form", "odds"],
                "count": 45,
                "hash": "f_hash_mock"
            },
            
            "split_version": "cpcv_v1",
            "model_version": "xgboost_v2",
            "random_seed": 42,
            "parameters": parameters,
            "metrics": metrics,
            
            # Calibration History Placeholder
            "calibration_history": {
                "brier_decomposition": {
                    "reliability": 0.0,
                    "resolution": 0.0,
                    "uncertainty": 0.0
                },
                "reliability_bins": []
            },
            
            "hashes": {
                "dataset_hash": dataset_hash,
                "feature_hash": "f_hash_mock",
                "split_hash": "s_hash_mock",
                "model_hash": parameter_hash,
                "prediction_hash": "p_hash_mock"
            }
        }
        
        # Calculate manifest hash
        manifest_str = json.dumps(manifest_data, sort_keys=True)
        manifest_hash = hashlib.sha256(manifest_str.encode('utf-8')).hexdigest()[:16]
        manifest_data["hashes"]["manifest_hash"] = manifest_hash
        
        filepath = exp_dir / "manifest.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)
            
        return str(filepath)

