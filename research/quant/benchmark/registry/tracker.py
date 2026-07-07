import os
from pathlib import Path
import yaml
import json
import pandas as pd
from datetime import datetime

class ExperimentTracker:
    def __init__(self, base_dir: str = None):
        if not base_dir:
            self.base_dir = Path(__file__).parent.parent
        else:
            self.base_dir = Path(base_dir)
            
        self.exp_dir = self.base_dir / "experiments"
        self.exp_dir.mkdir(parents=True, exist_ok=True)
        
    def _get_next_exp_id(self) -> str:
        existing = [d.name for d in self.exp_dir.iterdir() if d.is_dir() and d.name.startswith("EXP-")]
        if not existing:
            return "EXP-000001"
            
        numbers = [int(n.split('-')[1]) for n in existing]
        next_num = max(numbers) + 1
        return f"EXP-{str(next_num).zfill(6)}"
        
    def start_experiment(self) -> str:
        exp_id = self._get_next_exp_id()
        curr_dir = self.exp_dir / exp_id
        curr_dir.mkdir(parents=True, exist_ok=True)
        
        # Create skeleton files
        (curr_dir / "metadata.yaml").touch()
        (curr_dir / "metrics.json").touch()
        (curr_dir / "params.yaml").touch()
        
        # Skeleton Research Note
        note = f"""# Research Note: {exp_id}

## Hypothesis
Describe what you are testing...

## Result
(Filled automatically or manually)

## Decision
(PENDING / KEEP / REJECT)

## Reason
...
"""
        with open(curr_dir / "research_note.md", "w") as f:
            f.write(note)
            
        return exp_id
        
    def log_metadata(self, exp_id: str, metadata: dict):
        path = self.exp_dir / exp_id / "metadata.yaml"
        metadata['experiment_id'] = exp_id
        metadata['date'] = datetime.utcnow().strftime("%Y-%m-%d")
        with open(path, "w") as f:
            yaml.dump(metadata, f, default_flow_style=False)
            
    def log_metrics(self, exp_id: str, metrics: dict):
        path = self.exp_dir / exp_id / "metrics.json"
        with open(path, "w") as f:
            json.dump(metrics, f, indent=4)
            
    def log_params(self, exp_id: str, params: dict):
        path = self.exp_dir / exp_id / "params.yaml"
        with open(path, "w") as f:
            yaml.dump(params, f, default_flow_style=False)
            
    def log_predictions(self, exp_id: str, df: pd.DataFrame):
        path = self.exp_dir / exp_id / "predictions.parquet"
        df.to_parquet(path, index=False)
        
    def update_research_note(self, exp_id: str, decision: str, reason: str):
        path = self.exp_dir / exp_id / "research_note.md"
        if not path.exists():
            return
            
        with open(path, "r") as f:
            content = f.read()
            
        content = content.replace("(PENDING / KEEP / REJECT)", decision)
        content = content.replace("## Reason\n...", f"## Reason\n{reason}")
        
        with open(path, "w") as f:
            f.write(content)
