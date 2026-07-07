import yaml
from pathlib import Path

class ChampionRegistry:
    def __init__(self, base_dir: str = None):
        if not base_dir:
            self.base_dir = Path(__file__).parent.parent
        else:
            self.base_dir = Path(base_dir)
            
        self.champ_dir = self.base_dir / "champions"
        self.champ_dir.mkdir(parents=True, exist_ok=True)
        self.champ_file = self.champ_dir / "champion.yaml"
        
    def get_champion(self) -> dict:
        if not self.champ_file.exists():
            return None
        with open(self.champ_file, "r") as f:
            return yaml.safe_load(f)
            
    def promote_to_champion(self, exp_id: str, model_name: str, dataset_v: str, feature_v: str, brier: float, roi: float):
        data = {
            "champion": True,
            "experiment": exp_id,
            "model": model_name,
            "dataset": dataset_v,
            "feature": feature_v,
            "brier": round(brier, 4),
            "roi": round(roi, 2)
        }
        with open(self.champ_file, "w") as f:
            yaml.dump(data, f, default_flow_style=False)
            
    def evaluate_candidate(self, brier: float, roi: float, is_baseline: bool = False) -> tuple[bool, str]:
        """
        Evaluates if the candidate beats the current champion.
        Returns (is_promoted, reason).
        """
        champ = self.get_champion()
        
        if not champ:
            return True, "No existing champion. Promoted by default."
            
        champ_brier = champ.get("brier", 1.0)
        champ_roi = champ.get("roi", -100.0)
        
        # Lower Brier is better, Higher ROI is better
        brier_improved = brier < champ_brier
        roi_improved = roi > champ_roi
        
        if brier_improved and roi_improved:
            return True, f"Brier improved ({champ_brier} -> {brier}) and ROI improved ({champ_roi} -> {roi})"
        
        if not brier_improved:
            return False, f"Brier Score did not improve ({brier} >= {champ_brier})."
            
        if not roi_improved:
            return False, f"ROI did not improve ({roi} <= {champ_roi})."
            
        return False, "Failed to beat champion."
