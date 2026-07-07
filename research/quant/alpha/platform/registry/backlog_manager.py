import yaml
from enum import Enum
from pathlib import Path
from typing import Dict, Any, List

class BacklogState(Enum):
    READY = "Ready"
    RUNNING = "Running"
    WAITING_FOR_DATA = "Waiting for Data"
    HISTORICAL_VERIFIED = "Historical Verified"
    REJECTED = "Rejected"
    ARCHIVED = "Archived"

class BacklogManager:
    """
    State machine for managing the Research Backlog.
    Works in tandem with the Hypothesis Registry.
    """
    def __init__(self, registry_path: str = "research/quant/alpha/platform/knowledge/backlog"):
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(parents=True, exist_ok=True)
        
    def add_to_backlog(self, hypothesis_id: str, initial_state: BacklogState = BacklogState.READY):
        """Adds a hypothesis to the backlog."""
        file_path = self.registry_path / f"{hypothesis_id}_status.yaml"
        
        data = {
            "hypothesis_id": hypothesis_id,
            "status": initial_state.value
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False)
            
    def update_status(self, hypothesis_id: str, new_state: BacklogState):
        """Transitions the state of a hypothesis."""
        file_path = self.registry_path / f"{hypothesis_id}_status.yaml"
        if not file_path.exists():
            raise FileNotFoundError(f"Hypothesis {hypothesis_id} not found in backlog.")
            
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            
        data["status"] = new_state.value
        
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False)
            
    def get_by_state(self, state: BacklogState) -> List[str]:
        """Returns all hypothesis IDs in a given state."""
        matches = []
        for file_path in self.registry_path.glob("*_status.yaml"):
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                if data.get("status") == state.value:
                    matches.append(data.get("hypothesis_id"))
        return matches
