import json
import hashlib
import os
from datetime import datetime
from typing import Dict, Any

class ResearchLedger:
    """
    Immutable Research Ledger for tracking experiments and promotion gates.
    """
    def __init__(self, ledger_file: str = "research_ledger.jsonl"):
        self.ledger_file = ledger_file

    def log_experiment(self, experiment_id: str, git_commit: str, dataset_fingerprint: str, 
                       feature_version: str, config_hash: str, random_seed: int,
                       evidence_level: str, outcome: str, promotion_decision: str,
                       pipeline_version: str = "v42") -> Dict[str, Any]:
        """
        Creates an immutable record of an experiment in the ledger.
        """
        record = {
            "experiment_id": experiment_id,
            "git_commit": git_commit,
            "dataset_fingerprint": dataset_fingerprint,
            "feature_version": feature_version,
            "config_hash": config_hash,
            "random_seed": random_seed,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "evidence_level": evidence_level,
            "outcome": outcome,
            "promotion_decision": promotion_decision,
            "pipeline_version": pipeline_version
        }
        
        with open(self.ledger_file, "a") as f:
            f.write(json.dumps(record) + "\n")
            
        return record

def generate_manifest(experiment_id: str, git_commit: str, dataset_version: str,
                      feature_version: str, params: dict, evidence_level: str,
                      pipeline_version: str = "v42") -> dict:
    """
    Generates a Research Manifest for reproducibility.
    """
    manifest = {
        "experiment_id": experiment_id,
        "git_commit": git_commit,
        "dataset_version": dataset_version,
        "feature_version": feature_version,
        "parameter_hash": hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest(),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "random_seed": params.get("seed", 0),
        "evidence_level": evidence_level,
        "pipeline_version": pipeline_version,
    }
    return manifest
