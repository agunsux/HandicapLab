import pandas as pd
import pytest
from research.quant.alpha.market.engine.steam_engine import SteamEngine
from research.quant.alpha.market.pipeline.rq_pipeline import RQPipeline
from research.quant.alpha.market.evaluation.evidence_levels import EvidenceLevel
from pathlib import Path

def test_steam_engine_e2e_simulation():
    """
    Tests the full RQ Pipeline for Steam Moves using a Synthetic Fixture (Simulation Level).
    Validates that:
    1. Engines run end-to-end
    2. Scientific narrative is generated
    3. Evidence level is respected (Simulation -> NO ACS)
    4. Research Manifest is created
    """
    # 1. Synthetic Fixture Setup (SIMULATION ONLY)
    df_synthetic = pd.DataFrame({
        "match_id": [1, 1, 1],
        "timestamp": ["2026-07-01T10:00:00Z", "2026-07-01T11:00:00Z", "2026-07-01T12:00:00Z"],
        "bookmaker": ["Pinnacle", "Pinnacle", "Pinnacle"],
        "odds_home": [2.00, 1.95, 1.85]
    })
    
    # 2. Run Pipeline
    pipeline = RQPipeline(SteamEngine)
    
    manifest, alpha_meta = pipeline.run_experiment(
        rq_id="RQ-042-002",
        df=df_synthetic,
        hypothesis="Steam moves on Pinnacle are predictive.",
        evidence_level=EvidenceLevel.L1,  # SIMULATION
        dataset_ref="golden_dataset_v1.parquet",
        git_commit="abcdef12345",
        dataset_fingerprint="hash_synthetic_data",
        feature_version="v1.0",
        config_hash="hash_config",
        random_seed=42
    )
    
    # 3. Assertions
    # Manifest generated
    assert manifest["experiment_id"] == "RQ-042-002"
    assert manifest["evidence_level"] == "L1"
    
    # Alpha Extractor checks Evidence Level
    # Since L1 has 0.0 multiplier, ACS should be None
    assert alpha_meta["acs"] is None
    assert alpha_meta["status"] == "Simulation Validated"
    
    # Narrative generated
    base_dir = Path(__file__).parent.parent.parent
    narrative_path = base_dir / "narrative" / "narratives" / "RQ-042-002_narrative.md"
    assert narrative_path.exists()
    
    # Check Simulation banner
    with open(narrative_path, 'r') as f:
        content = f.read()
        assert "SIMULATION ONLY — NOT RESEARCH EVIDENCE" in content
        
    print("Test Passed: End-to-end Simulation Pipeline respects Governance boundaries.")

if __name__ == "__main__":
    test_steam_engine_e2e_simulation()
