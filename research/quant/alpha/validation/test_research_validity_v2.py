import os
import shutil
import numpy as np
import pandas as pd
from research.quant.alpha.platform.registry.dataset_registry import DatasetRegistry
from research.quant.alpha.platform.registry.snapshot_manager import SnapshotManager
from research.quant.alpha.platform.registry.manifest_generator import ManifestGenerator
from research.quant.alpha.platform.registry.registry import ResearchRegistry
from research.quant.alpha.platform.reporting.promotion_gate import PromotionGate
from research.quant.alpha.validation.diagnostics.calibration import ProbabilityDiagnostics
from research.quant.alpha.validation.statistics.diebold_mariano import DieboldMariano

def test_research_validity_v2_e2e():
    """
    E2E Test simulating the robust Phase A Refinement Lifecycle.
    Tests Happy Path, Failure Paths (Missing Artifact, Reproducibility < 100), and Immutable Champions.
    """
    base_dir = "test_validity_layer_v2"
    if os.path.exists(base_dir):
        shutil.rmtree(base_dir)
        
    try:
        # Mock Data Setup
        matches_df = pd.DataFrame({"match_id": range(100), "kickoff": pd.date_range("2026-01-01", periods=100)})
        odds_df = pd.DataFrame({"match_id": range(100), "odds": np.random.uniform(1.5, 3.0, 100)})
        
        # 1. Dataset Registry & Snapshot Manager
        print("\n--- 1. Dataset Registry & Snapshot ---")
        ds_registry = DatasetRegistry(f"{base_dir}/dataset_registry.json")
        sm = SnapshotManager(base_path=f"{base_dir}/snapshots", registry=ds_registry)
        dataset_id = sm.create_snapshot(matches_df, odds_df)
        print(f"Created Snapshot. Dataset ID: {dataset_id}")
        assert ds_registry.get_dataset(dataset_id) is not None
        
        # 2. Experiment Setup
        experiment_id_1 = "EXP-001-HappyPath"
        experiment_id_2 = "EXP-002-MissingArtifact"
        registry = ResearchRegistry(registry_file=f"{base_dir}/registry.json")
        
        print("\n--- 2. Happy Path to PROMOTED ---")
        # Simulating passing all checks
        output_dir = f"{base_dir}/artifacts/{experiment_id_1}"
        conf_report_path = PromotionGate.generate_confidence_report(True, True, True, True, output_dir)
        
        repro_score = PromotionGate.calculate_reproducibility_score({
            "dataset_snapshot": True, "feature_hash": True, "split_hash": True, 
            "git_commit": True, "random_seed": True, "manifest": True, "predictions": True
        })
        
        status, reasons = PromotionGate.evaluate_candidate(
            cpcv_passed=True, walk_forward_passed=True, dm_significant=True, 
            ece_calibrated=True, reproducibility_score=repro_score, confidence_report_exists=os.path.exists(conf_report_path)
        )
        
        manifest_path = ManifestGenerator.generate_manifest(
            experiment_id=experiment_id_1, dataset_snapshot=dataset_id, metrics={"brier": 0.04}, 
            parameters={"lr": 0.01}, promotion_status=status, output_dir=f"{base_dir}/artifacts"
        )
        
        registry.register_experiment(experiment_id_1, ["Baseline"], manifest_path, status)
        if status == "CHAMPION_CANDIDATE":
            registry.set_champion(experiment_id_1)
        print(f"{experiment_id_1} Status: {status} | Reasons: {reasons} | Score: {repro_score}")
        print(f"CURRENT_CHAMPION is now: {registry.get_champion()}")
        assert registry.get_champion() == experiment_id_1
        
        print("\n--- 3. Failure Path: Missing Artifacts & Score < 100 ---")
        # Simulating a failed experiment (no confidence report, bad score)
        repro_score_bad = PromotionGate.calculate_reproducibility_score({
            "dataset_snapshot": True, "feature_hash": True, "split_hash": False,  # Missing split hash
            "git_commit": True, "random_seed": True, "manifest": True, "predictions": False # Missing predictions
        })
        
        status_bad, reasons_bad = PromotionGate.evaluate_candidate(
            cpcv_passed=True, walk_forward_passed=True, dm_significant=True, 
            ece_calibrated=True, reproducibility_score=repro_score_bad, confidence_report_exists=False
        )
        
        manifest_path_bad = ManifestGenerator.generate_manifest(
            experiment_id=experiment_id_2, dataset_snapshot=dataset_id, metrics={"brier": 0.04}, 
            parameters={"lr": 0.01}, promotion_status=status_bad, output_dir=f"{base_dir}/artifacts"
        )
        
        registry.register_experiment(experiment_id_2, [experiment_id_1], manifest_path_bad, status_bad)
        print(f"{experiment_id_2} Status: {status_bad} | Reasons: {reasons_bad} | Score: {repro_score_bad}")
        assert "REJECTED" in status_bad
        assert "confidence_report_missing" in reasons_bad
        
        print("\n--- 4. Immutable Champions Rollback ---")
        print(f"CURRENT_CHAMPION is STILL: {registry.get_champion()}")
        assert registry.get_champion() == experiment_id_1
        
        print("\n--- Phase A Refinement Tests Passed Successfully ---")
        
    finally:
        if os.path.exists(base_dir):
            shutil.rmtree(base_dir)

if __name__ == "__main__":
    test_research_validity_v2_e2e()
