from research.quant.alpha.market.manifest.research_manifest import ResearchLedger, generate_manifest
from typing import Dict, Any

class ExperimentTracker:
    """
    Tracks an experiment and logs it to the immutable Research Ledger.
    """
    def __init__(self):
        self.ledger = ResearchLedger()
        
    def record_experiment(self, experiment_id: str, git_commit: str, 
                          dataset_fingerprint: str, feature_version: str, 
                          config_hash: str, random_seed: int, evidence_level: str, 
                          outcome: str, promotion_decision: str) -> Dict[str, Any]:
        """
        Records the experiment to the ledger and returns the generated manifest.
        """
        # Log to ledger
        self.ledger.log_experiment(
            experiment_id=experiment_id,
            git_commit=git_commit,
            dataset_fingerprint=dataset_fingerprint,
            feature_version=feature_version,
            config_hash=config_hash,
            random_seed=random_seed,
            evidence_level=evidence_level,
            outcome=outcome,
            promotion_decision=promotion_decision
        )
        
        # Return manifest for local storage/reproducibility
        manifest = generate_manifest(
            experiment_id=experiment_id,
            git_commit=git_commit,
            dataset_version=dataset_fingerprint,  # Using fingerprint as version
            feature_version=feature_version,
            params={"config_hash": config_hash, "seed": random_seed},
            evidence_level=evidence_level
        )
        
        return manifest
