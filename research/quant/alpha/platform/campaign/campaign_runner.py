import uuid
import time
from typing import List, Dict, Any
from research.quant.alpha.platform.orchestration.orchestrator import ExperimentOrchestrator
from research.quant.alpha.platform.statistical.fdr_controller import FDRController
from research.quant.alpha.platform.registry.backlog_manager import BacklogManager, BacklogState

class BatchCampaignRunner:
    """
    Executes dozens of hypotheses in a batch campaign to validate the L2 pipeline.
    """
    def __init__(self, orchestrator: ExperimentOrchestrator, backlog_manager: BacklogManager):
        self.orchestrator = orchestrator
        self.backlog_manager = backlog_manager
        
    def run_campaign(self, campaign_name: str, hypothesis_ids: List[str]) -> Dict[str, Any]:
        """
        Runs a full batch campaign. Updates backlog status, triggers orchestrator, and applies FDR across the batch.
        """
        campaign_id = f"CAMP-{uuid.uuid4().hex[:6].upper()}"
        print(f"Starting {campaign_name} ({campaign_id}) for {len(hypothesis_ids)} hypotheses.")
        
        start_time = time.time()
        results = []
        p_values = []
        
        # 1. Update Status to Running & Execute
        for h_id in hypothesis_ids:
            self.backlog_manager.update_status(h_id, BacklogState.RUNNING)
            
            # Mocking hyperparameter grid mapping for the campaign
            exp_res = self.orchestrator.run_experiment_mock(f"EXP_{h_id}", h_id, {"campaign": campaign_id})
            results.append(exp_res)
            p_values.append(exp_res["p_value"])
            
        # 2. Apply Multiple Testing Control (FDR) on the whole batch
        fdr_results = FDRController.benjamini_hochberg(p_values, false_discovery_rate=0.05)
        
        # 3. Process outcomes
        for i, res in enumerate(results):
            h_id = hypothesis_ids[i]
            if i in fdr_results["significant_indices"]:
                # Pass
                res["passes_fdr"] = True
            else:
                # Fail
                res["passes_fdr"] = False
                
        total_wall_time = time.time() - start_time
        
        campaign_summary = {
            "campaign_id": campaign_id,
            "campaign_name": campaign_name,
            "hypotheses_tested": len(hypothesis_ids),
            "fdr_threshold": fdr_results["adjusted_threshold"],
            "significant_count": len(fdr_results["significant_indices"]),
            "total_wall_time_sec": total_wall_time,
            "experiment_results": results
        }
        
        return campaign_summary
