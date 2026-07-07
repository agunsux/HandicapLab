from pathlib import Path
import yaml

class Leaderboard:
    def __init__(self, base_dir: str = None):
        if not base_dir:
            self.base_dir = Path(__file__).parent.parent
        else:
            self.base_dir = Path(base_dir)
            
        self.lb_dir = self.base_dir / "leaderboard"
        self.lb_dir.mkdir(parents=True, exist_ok=True)
        self.lb_file = self.lb_dir / "leaderboard.md"
        
    def generate_leaderboard(self):
        exp_dir = self.base_dir / "experiments"
        if not exp_dir.exists():
            return
            
        entries = []
        for exp in exp_dir.iterdir():
            if not exp.is_dir() or not exp.name.startswith("EXP-"):
                continue
                
            meta_file = exp / "metadata.yaml"
            metrics_file = exp / "metrics.json" # Not directly parsed here for simplicity, we assume metrics are in metadata for the leaderboard, or we parse both
            
            if not meta_file.exists():
                continue
                
            with open(meta_file, 'r') as f:
                meta = yaml.safe_load(f)
                
            if not meta:
                continue
                
            # Attempt to grab metrics if they were copied into meta, 
            # otherwise set defaults. In real app, parse metrics.json too.
            import json
            brier = 999.0
            roi = -999.0
            if metrics_file.exists():
                with open(metrics_file, 'r') as f:
                    mets = json.load(f)
                    brier = mets.get("brier", 999.0)
                    roi = mets.get("roi", -999.0)
                    
            entries.append({
                "Rank": 0,
                "Experiment": exp.name,
                "Model": meta.get("model", "unknown"),
                "Brier": round(brier, 4),
                "ROI": round(roi, 2),
                "Status": meta.get("status", "Archived"),
                "Champion": meta.get("champion", False)
            })
            
        # Sort primarily by Champion first, then Brier (lower is better)
        entries.sort(key=lambda x: (-x['Champion'], x['Brier']))
        
        md_content = "# Benchmark Leaderboard\n\n"
        md_content += "| Rank | Experiment | Model | Brier | ROI | Status |\n"
        md_content += "| ---: | ---------- | -------- | ----: | --: | -------- |\n"
        
        for i, entry in enumerate(entries):
            rank = i + 1
            status = "Champion" if entry['Champion'] else entry['Status']
            md_content += f"| {rank} | {entry['Experiment']} | {entry['Model']} | {entry['Brier']} | {entry['ROI']} | {status} |\n"
            
        with open(self.lb_file, "w") as f:
            f.write(md_content)
