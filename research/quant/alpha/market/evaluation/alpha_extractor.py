from research.quant.alpha.market.evaluation.evidence_levels import EvidenceLevel
from research.quant.alpha.market.evaluation.acs_calculator import ACSCalculator
import yaml
from pathlib import Path

class AlphaExtractor:
    """
    Evaluates RQ results and generates candidate alphas if the evidence level is sufficient.
    """
    def __init__(self, registry_dir: str = "../governance"):
        base_dir = Path(__file__).parent
        self.registry_dir = base_dir / registry_dir
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self.acs_calculator = ACSCalculator()

    def process_rq_result(self, rq_id: str, raw_metrics: dict, evidence_level: EvidenceLevel):
        """
        Processes an RQ result and extracts an alpha if applicable.
        """
        # Get ACS and Governance metrics
        acs_result = self.acs_calculator.calculate_acs(raw_metrics, evidence_level.value)
        
        alpha_id = f"A-{rq_id.replace('RQ-', '')}"
        
        alpha_metadata = {
            "alpha_id": alpha_id,
            "source_rq": rq_id,
            "evidence_level": evidence_level.value,
            "acs": acs_result.get("acs_final"),
            "status": "Simulation Validated" if evidence_level in [EvidenceLevel.L0, EvidenceLevel.L1] else "Under Review",
            "governance_metrics": {
                "novelty": acs_result.get("novelty"),
                "robustness": acs_result.get("robustness"),
                "deployability": acs_result.get("deployability")
            },
            "history": [
                {
                    "stage": "Simulation" if evidence_level == EvidenceLevel.L1 else "Historical",
                    "reason": "Initial extraction from RQ pipeline"
                }
            ]
        }
        
        # Save to Alpha Registry (YAML)
        filepath = self.registry_dir / f"{alpha_id}.yaml"
        with open(filepath, 'w') as f:
            yaml.dump(alpha_metadata, f, sort_keys=False)
            
        return alpha_metadata
