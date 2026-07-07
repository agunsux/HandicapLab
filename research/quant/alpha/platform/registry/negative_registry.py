import yaml
from enum import Enum
from pathlib import Path
from typing import Dict, Any

class FailureTaxonomy(Enum):
    NO_STATISTICAL_SIGNAL = "No Statistical Signal"
    DATA_QUALITY_ISSUE = "Data Quality Issue"
    FEATURE_LEAKAGE = "Feature Leakage"
    OVERFITTING = "Overfitting"
    LOW_SAMPLE_SIZE = "Low Sample Size"
    NOT_REPRODUCIBLE = "Not Reproducible"
    BASELINE_NOT_BEATEN = "Baseline Not Beaten"
    HIGH_VARIANCE = "High Variance"
    REGIME_DEPENDENT = "Regime Dependent"

class NegativeResultRegistry:
    """
    The graveyard for failed hypotheses, strictly categorized for long-term learning.
    """
    def __init__(self, registry_path: str = "research/quant/alpha/platform/knowledge/negative_results"):
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(parents=True, exist_ok=True)
        
    def log_failure(self, hypothesis_id: str, taxonomy: FailureTaxonomy, evidence: str, specs: Dict[str, Any]):
        """
        Logs why an experiment failed to be promoted.
        """
        file_path = self.registry_path / f"{hypothesis_id}_failure.yaml"
        
        data = {
            "hypothesis_id": hypothesis_id,
            "failure_reason": taxonomy.value,
            "evidence_notes": evidence,
            "experiment_specs": specs
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False)
            
        print(f"Logged Negative Result for {hypothesis_id} under '{taxonomy.value}'")
