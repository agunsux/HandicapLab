import os
import shutil
from research.quant.alpha.platform.registry.backlog_manager import BacklogManager, BacklogState
from research.quant.alpha.platform.orchestration.orchestrator import ExperimentOrchestrator
from research.quant.alpha.platform.campaign.campaign_runner import BatchCampaignRunner
from research.quant.alpha.platform.dashboard.campaign_dashboard import CampaignDashboard
from research.quant.alpha.platform.library.alpha_library import AlphaLibrary

def test_batch_campaign_e2e():
    """
    Simulates Campaign 001 running a batch of 20 hypotheses.
    Demonstrates the Alpha Funnel, FDR multiple testing control, and Alpha Library promotion.
    """
    base_dir = "test_batch_campaign"
    if os.path.exists(base_dir):
        shutil.rmtree(base_dir)
        
    try:
        # 1. Initialize Managers
        backlog = BacklogManager(registry_path=f"{base_dir}/backlog")
        orchestrator = ExperimentOrchestrator(db_path=f"{base_dir}/ledger.duckdb")
        runner = BatchCampaignRunner(orchestrator, backlog)
        library = AlphaLibrary(library_path=f"{base_dir}/alpha_library")
        
        # 2. Add 20 mock hypotheses to Backlog
        hypotheses = [f"RQ-0{str(i).zfill(2)}" for i in range(1, 21)]
        for h_id in hypotheses:
            backlog.add_to_backlog(h_id)
            
        assert len(backlog.get_by_state(BacklogState.READY)) == 20
        
        # 3. Run Batch Campaign 001
        print("Executing Batch Campaign 001...")
        # Note: orchestrator mock currently yields p_value=0.04 for all.
        # With 20 tests all having p=0.04 and FDR=0.05, BH will actually pass them ALL 
        # (since 0.04 < (20/20)*0.05). 
        # To make it realistic for the funnel, we'll let the mock return it, 
        # but in reality most hypotheses would have higher p-values.
        # So we override the mock in the runner just for testing the funnel drop-off:
        
        # We'll temporarily monkeypatch the mock run so some fail
        original_mock = orchestrator.run_experiment_mock
        def mock_with_variance(exp_id, h_id, hyper):
            # Only RQ-001 and RQ-002 have strong signals (p=0.001)
            # The rest have weak/no signals (p=0.2 to 0.8)
            import random
            random.seed(h_id) # deterministic
            p_val = 0.001 if h_id in ["RQ-001", "RQ-002"] else random.uniform(0.1, 0.9)
            return {"experiment_id": exp_id, "p_value": p_val}
            
        orchestrator.run_experiment_mock = mock_with_variance
        
        campaign_summary = runner.run_campaign("Campaign 001 - Reversal Alpha", hypotheses)
        
        # 4. Dashboard Funnel
        CampaignDashboard.print_funnel_report(campaign_summary)
        
        # 5. Library Promotion and Backlog Update
        for res in campaign_summary["experiment_results"]:
            h_id = res["experiment_id"].replace("EXP_", "")
            if res["passes_fdr"]:
                backlog.update_status(h_id, BacklogState.HISTORICAL_VERIFIED)
                library.add_to_library(h_id, "Reversal Strategy", "Odds shock", res)
            else:
                backlog.update_status(h_id, BacklogState.REJECTED)
                
        # 6. Verifications
        assert len(backlog.get_by_state(BacklogState.HISTORICAL_VERIFIED)) == 2 # RQ-001 and RQ-002
        assert len(backlog.get_by_state(BacklogState.REJECTED)) == 18
        
        print("\nTest Passed: Batch Campaign Orchestration successfully processed 20 hypotheses, tracked the funnel, and generated Alpha Library IP.")
        
    finally:
        if os.path.exists(base_dir):
            shutil.rmtree(base_dir)

if __name__ == "__main__":
    test_batch_campaign_e2e()
