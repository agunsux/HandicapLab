import json
from pathlib import Path
from typing import List

class ResearchRegistry:
    """
    JSON Registry tracker for experiment lineage using Directed Acyclic Graph (DAG) logic.
    Maintains Immutable Champions via a CURRENT_CHAMPION pointer.
    """
    
    def __init__(self, registry_file: str = "research/registry.json"):
        self.registry_file = Path(registry_file)
        if not self.registry_file.exists():
            self.registry_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.registry_file, "w", encoding="utf-8") as f:
                json.dump({"experiments": {}, "CURRENT_CHAMPION": None}, f)
                
    def register_experiment(self, experiment_id: str, parents: List[str], manifest_path: str, status: str = "COMPLETED"):
        """
        Registers an experiment and its DAG lineage.
        """
        with open(self.registry_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        data["experiments"][experiment_id] = {
            "parents": parents,
            "manifest": manifest_path,
            "status": status
        }
        
        with open(self.registry_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            
    def set_champion(self, experiment_id: str):
        """
        Sets the CURRENT_CHAMPION pointer. Champions are immutable in the Artifact Registry.
        """
        with open(self.registry_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        if experiment_id not in data["experiments"]:
            raise ValueError(f"Experiment {experiment_id} not found in registry.")
            
        data["CURRENT_CHAMPION"] = experiment_id
        data["experiments"][experiment_id]["status"] = "CHAMPION"
        
        with open(self.registry_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_champion(self) -> str:
        with open(self.registry_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("CURRENT_CHAMPION")
