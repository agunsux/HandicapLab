import os
import shutil
import numpy as np
import pandas as pd
from datetime import datetime
from research.quant.alpha.platform.registry.snapshot_manager import SnapshotManager
from research.quant.alpha.platform.registry.manifest_generator import ManifestGenerator
from research.quant.alpha.platform.registry.registry import ResearchRegistry
from research.quant.alpha.platform.reporting.prediction_archive import PredictionArchive
from research.quant.alpha.validation.leakage.leakage_auditor import LeakageAuditor
from research.quant.alpha.validation.splitters.cpcv import CombinatorialPurgedCV
from research.quant.alpha.validation.statistics.diebold_mariano import DieboldMariano
from research.quant.alpha.validation.diagnostics.calibration import ProbabilityDiagnostics
from research.quant.alpha.platform.reporting.promotion_gate import PromotionGate

def test_research_validity_e2e():
    """
    E2E Test simulating the full Phase A Research Validity Layer.
    From raw data -> leakage audit -> snapshot -> CPCV -> prediction archive -> calibration -> promotion.
    """
    base_dir = "test_validity_layer"
    if os.path.exists(base_dir):
        shutil.rmtree(base_dir)
        
    try:
        # Mock Data
        dates = pd.date_range(start="2026-01-01", periods=1000, freq='h')
        matches_df = pd.DataFrame({
            "match_id": range(1000),
            "kickoff": dates,
            "home_team": ["A"] * 1000,
            "away_team": ["B"] * 1000
        })
        odds_df = pd.DataFrame({"match_id": range(1000), "odds": np.random.uniform(1.5, 3.0, 1000)})
        
        # 1. Leakage Audit
        print("\n--- 1. Leakage Audit ---")
        features = ["rolling_win_rate", "avg_goals"]
        LeakageAuditor.audit_time_leakage(matches_df, "kickoff", features, "target_win")
        
        # 2. Snapshot Creation (Immutable Parquet)
        print("\n--- 2. Snapshot Manager ---")
        sm = SnapshotManager(base_path=f"{base_dir}/snapshots")
        snapshot_id = sm.create_snapshot(matches_df, odds_df)
        print(f"Created Immutable Snapshot: {snapshot_id}")
        
        # 3. CPCV Split
        print("\n--- 3. Combinatorial Purged CV ---")
        cpcv = CombinatorialPurgedCV(n_splits=3, n_test_splits=1)
        splits = list(cpcv.split(matches_df, "kickoff"))
        print(f"Generated {len(splits)} CPCV paths with Purge/Embargo.")
        
        # Mocking model training and predictions
        experiment_id = "EXP-9999"
        predictions_df = pd.DataFrame({
            "match_id": matches_df["match_id"],
            "prediction_time": matches_df["kickoff"],
            "market": "1X2",
            "probability": np.random.uniform(0, 1, 1000),
            "odds": odds_df["odds"],
            "label": np.random.randint(0, 2, 1000),
            "result": "W"
        })
        
        # 4. Prediction Archive
        print("\n--- 4. Prediction Archive ---")
        pa = PredictionArchive(archive_path=f"{base_dir}/predictions")
        archive_path = pa.archive_predictions(experiment_id, predictions_df)
        print(f"Archived predictions to Parquet: {archive_path}")
        
        # 5. Statistical Significance (Diebold-Mariano)
        print("\n--- 5. Statistical Significance ---")
        # Mock errors: our model has lower error than baseline
        err_model = np.random.normal(0, 0.5, 100)
        err_baseline = np.random.normal(0, 1.0, 100)
        dm_result = DieboldMariano.test(err_model, err_baseline)
        print(f"Diebold-Mariano p-value: {dm_result['p_value']:.4f}")
        
        # 6. Probability Diagnostics (Calibration)
        print("\n--- 6. Probability Diagnostics ---")
        # Force a good ECE for testing promotion
        good_probs = predictions_df["label"] * 0.9 + np.random.uniform(0, 0.1, 1000)
        cal_result = ProbabilityDiagnostics.calculate_brier_and_ece(predictions_df["label"].values, good_probs.values)
        print(f"Expected Calibration Error (ECE): {cal_result['ece']:.4f}")
        
        # 7. Promotion Gate
        print("\n--- 7. Promotion Gate ---")
        final_state = PromotionGate.evaluate_candidate(
            cpcv_passed=True,
            walk_forward_passed=True,
            dm_significant=dm_result["significant"],
            ece_calibrated=cal_result["calibrated"]
        )
        
        # 8. Manifest and Registry Update
        print("\n--- 8. Experiment Manifest & Registry ---")
        manifest_path = ManifestGenerator.generate_manifest(
            experiment_id=experiment_id,
            dataset_snapshot=snapshot_id,
            metrics={"brier": cal_result["brier_score"], "ece": cal_result["ece"]},
            parameters={"lr": 0.01},
            promotion_status=final_state,
            output_dir=f"{base_dir}/manifests"
        )
        print(f"Manifest Generated: {manifest_path}")
        
        registry = ResearchRegistry(registry_file=f"{base_dir}/registry.json")
        registry.register_experiment(experiment_id, "NONE", manifest_path, final_state)
        print(f"Registered {experiment_id} in Research Registry with status: {final_state}")
        
        print("\n--- Phase A Test Passed Successfully ---")
        
    finally:
        if os.path.exists(base_dir):
            shutil.rmtree(base_dir)

if __name__ == "__main__":
    test_research_validity_e2e()
