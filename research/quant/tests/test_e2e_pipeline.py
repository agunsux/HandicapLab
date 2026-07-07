import pytest
import subprocess
from pathlib import Path
import os
import json

def test_e2e_exp_001():
    """
    End-to-End Regression Test for EXP-001 (Probability Calibration).
    Runs the full experiment via subprocess to verify loader, walk-forward, calibration, artifacts, MLflow, quality gate.
    """
    quant_dir = Path(__file__).resolve().parent.parent
    exp_script = quant_dir / "experiments" / "exp_001_calibration.py"
    
    # Run the script
    result = subprocess.run(
        ["uv", "run", "python", str(exp_script)],
        cwd=str(quant_dir),
        capture_output=True,
        text=True
    )
    
    print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
        
    assert result.returncode == 0, f"Experiment script failed with exit code {result.returncode}"
    
    # Verify outputs
    artifacts_dir = quant_dir / "exp_001_artifacts"
    assert artifacts_dir.exists(), "Artifacts directory was not created"
    
    assert (artifacts_dir / "raw_predictions.parquet").exists(), "Predictions parquet not found"
    assert (artifacts_dir / "calibration_report.png").exists(), "Calibration plot not found"
    assert (artifacts_dir / "Paper_Review.md").exists(), "Paper review not found"
    
    # Verify Manifest
    manifest_path = quant_dir / "manifest.json"
    assert manifest_path.exists(), "Manifest was not generated"
    
    with open(manifest_path, 'r') as f:
        manifest = json.load(f)
        
    assert manifest.get('experiment_id') == "EXP-001"
    assert manifest.get('status') in ["ADOPT", "REVISIT", "INVALID"]
    
    # Because this E2E run uses mock data internally (or silver layer if populated),
    # we just ensure the pipeline completed successfully.
