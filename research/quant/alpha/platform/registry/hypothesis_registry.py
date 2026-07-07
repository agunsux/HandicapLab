import yaml
import os
from pathlib import Path
from typing import Dict, Any

class HypothesisRegistry:
    """
    Manages the lifecycle of Research Hypotheses as immutable YAML files.
    """
    def __init__(self, registry_path: str = "research/quant/alpha/platform/knowledge/hypotheses"):
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(parents=True, exist_ok=True)
        
    def register_hypothesis(self, base_id: str, author: str, rationale: str, metadata: Dict[str, Any]) -> str:
        """
        Creates a new immutable version of a hypothesis.
        """
        existing_versions = list(self.registry_path.glob(f"{base_id}_v*.yaml"))
        next_version = len(existing_versions) + 1
        
        full_id = f"{base_id}_v{next_version}"
        file_path = self.registry_path / f"{full_id}.yaml"
        
        data = {
            "hypothesis_id": full_id,
            "hypothesis_version": next_version,
            "author": author,
            "rationale": rationale,
            "metadata": metadata,
            "change_log": "Initial creation" if next_version == 1 else "Version incremented."
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False)
            
        print(f"Registered immutable hypothesis: {full_id}")
        return full_id
