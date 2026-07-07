import yaml
from pathlib import Path

class ACSCalculator:
    """
    Calculates the Alpha Confidence Score (ACS).
    Also computes three independent governance scores:
    - Novelty Score
    - Robustness Score
    - Deployability Score
    """
    def __init__(self, config_path: str = "acs_config.yaml"):
        # Resolve config path
        base_dir = Path(__file__).parent.parent / "config"
        self.config_path = base_dir / config_path
        self._load_config()

    def _load_config(self):
        with open(self.config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            
    def calculate_acs(self, raw_metrics: dict, evidence_level: str) -> dict:
        """
        Calculates ACS by applying the evidence multiplier.
        """
        multiplier = self.config['evidence_levels'].get(evidence_level, {}).get('multiplier', 0.0)
        
        # If evidence is L0 or L1, ACS is null (Simulation Only)
        if multiplier == 0.0:
            return {
                "acs_final": None,
                "status": "Insufficient Evidence",
                "novelty": self._calc_novelty(raw_metrics),
                "robustness": self._calc_robustness(raw_metrics),
                "deployability": self._calc_deployability(raw_metrics)
            }
            
        weights = self.config['acs']['weights']
        
        # Mock calculation based on weights
        stat_strength = raw_metrics.get('statistical_strength', 50) * weights['statistical_strength']
        rep = raw_metrics.get('replication', 50) * weights['replication']
        gen = raw_metrics.get('generalization', 50) * weights['generalization']
        clv = raw_metrics.get('clv_consistency', 50) * weights['clv_consistency']
        dqs = raw_metrics.get('dataset_quality', 50) * weights['dataset_quality']
        
        raw_acs = stat_strength + rep + gen + clv + dqs
        final_acs = raw_acs * multiplier
        
        return {
            "acs_final": round(final_acs, 2),
            "status": "Calculated",
            "novelty": self._calc_novelty(raw_metrics),
            "robustness": self._calc_robustness(raw_metrics),
            "deployability": self._calc_deployability(raw_metrics)
        }
        
    def _calc_novelty(self, metrics: dict) -> int:
        return metrics.get("novelty_raw", 70)
        
    def _calc_robustness(self, metrics: dict) -> int:
        return metrics.get("robustness_raw", 85)
        
    def _calc_deployability(self, metrics: dict) -> int:
        return metrics.get("deployability_raw", 90)
