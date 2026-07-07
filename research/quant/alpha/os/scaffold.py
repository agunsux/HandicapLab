import os
from pathlib import Path

base = Path("c:/Users/RYZEN/.antigravity-ide/HandicapLab/research/quant/alpha/os")

dirs = [
    "knowledge/rq",
    "knowledge/alpha",
    "knowledge/graveyard",
    "knowledge/promotion",
    "sync",
    "event",
    "evaluation",
    "governance"
]

for d in dirs:
    (base / d).mkdir(parents=True, exist_ok=True)
    
# Create some initial YAML/MD templates
alpha_yaml_tmpl = """alpha_id: A-041
name: Example Alpha Signal
status: TESTING
owner: research_engine
reviewer: auto

depends_on:
  - RQ-040-001
  - EXP-221
  - DATASET-014

produces:
  - FEATURE-018

metrics:
  sample_size: 15000
  roi: 0.052
  clv: 0.021
  brier: 0.181
  p_value: 0.012

evidence_level: null
replication_score: null
"""
with open(base / "knowledge" / "alpha" / "template_alpha.yaml", "w") as f:
    f.write(alpha_yaml_tmpl)

reject_md_tmpl = """# Rejection Report: A-017

## Reason
Failed replication

## Evidence
- Walk Forward failed (Test set 2023 yielded negative ROI)
- CI lower bound is below zero (-0.012)
- Negative CLV on Pinnacle markets

## Notes
Feature only worked during COVID season. Regime specific anomaly.
"""
with open(base / "knowledge" / "graveyard" / "template_rejection.md", "w") as f:
    f.write(reject_md_tmpl)
    
print("Directories and templates created successfully.")
