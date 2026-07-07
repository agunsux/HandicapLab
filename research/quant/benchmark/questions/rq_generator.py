import os
from pathlib import Path

class ResearchQuestionGenerator:
    def __init__(self, base_dir: str = None):
        if not base_dir:
            self.base_dir = Path(__file__).parent
        else:
            self.base_dir = Path(base_dir)
            
    def _get_next_rq_id(self) -> str:
        existing = [f.name for f in self.base_dir.iterdir() if f.is_file() and f.name.startswith("RQ-")]
        if not existing:
            return "RQ-001"
            
        numbers = [int(n.replace('RQ-', '').replace('.md', '')) for n in existing]
        next_num = max(numbers) + 1
        return f"RQ-{str(next_num).zfill(3)}"
        
    def create_rq_report(self, 
                         question: str, 
                         datasets: list, 
                         experiments: list, 
                         winner: str,
                         improvement: float,
                         p_value: float,
                         effect_size: float,
                         bootstrap_pass: bool,
                         lolo_pass: bool,
                         walk_forward_pass: bool,
                         production_status: str):
        rq_id = self._get_next_rq_id()
        
        md_content = f"""# {rq_id}

## Question
{question}

## Status
Completed

## Datasets
"""
        for ds in datasets:
            md_content += f"- {ds}\n"
            
        md_content += "\n## Experiments\n"
        for exp in experiments:
            md_content += f"- {exp}\n"
            
        md_content += f"""
## Winner
{winner}

## Improvement
+{improvement:.2f}% ROI

## Statistical Gates
| Metric | Value | Status |
|---|---|---|
| p-value | {p_value:.4f} | {'PASS' if p_value <= 0.05 else 'FAIL'} |
| Effect Size | {effect_size:.2f} | {'PASS' if effect_size >= 0.1 else 'FAIL'} |
| Bootstrap CI | Lower > 0 | {'PASS' if bootstrap_pass else 'FAIL'} |
| LOLO | Stable | {'PASS' if lolo_pass else 'FAIL'} |
| Walk Forward | No Leakage | {'PASS' if walk_forward_pass else 'FAIL'} |

## Production
**{production_status}**
"""
        with open(self.base_dir / f"{rq_id}.md", "w") as f:
            f.write(md_content)
            
        return rq_id
