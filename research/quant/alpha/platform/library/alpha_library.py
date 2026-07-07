import yaml
from pathlib import Path
from typing import Dict, Any

class AlphaLibrary:
    """
    The Intellectual Property Vault. Only holds Alphas that have passed the L2 Historical Validation.
    """
    def __init__(self, library_path: str = "research/quant/alpha/platform/library/assets"):
        self.library_path = Path(library_path)
        self.library_path.mkdir(parents=True, exist_ok=True)
        
    def add_to_library(self, hypothesis_id: str, description: str, mechanism: str, statistical_evidence: Dict[str, Any]):
        """
        Promotes a hypothesis into an official Alpha Asset in the Library.
        """
        alpha_id = f"ALPHA_{hypothesis_id.replace('-', '_')}"
        file_path = self.library_path / f"{alpha_id}.yaml"
        
        data = {
            "alpha_id": alpha_id,
            "hypothesis_id": hypothesis_id,
            "description": description,
            "mechanism": mechanism,
            "statistical_evidence": statistical_evidence,
            "promotion_status": "L2_HISTORICAL_VERIFIED"
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False)
            
        print(f"IP Created: Promoted {hypothesis_id} to {alpha_id} in Alpha Library.")
        return alpha_id
