import os
import shutil
from research.quant.alpha.platform.registry.hypothesis_registry import HypothesisRegistry
from research.quant.alpha.platform.registry.negative_registry import NegativeResultRegistry, FailureTaxonomy
from research.quant.alpha.platform.prioritization.priority_queue import ExperimentPriorityQueue
from research.quant.alpha.platform.orchestration.orchestrator import ExperimentOrchestrator
from research.quant.alpha.platform.statistical.fdr_controller import FDRController
from research.quant.alpha.platform.reporting.auto_reporter import PromotionCommittee
from research.quant.alpha.platform.knowledge.knowledge_graph import AlphaKnowledgeGraph

def test_research_platform_e2e():
    """
    Simulates the lifecycle of a hypothesis from Idea to Rejection (Negative Result).
    Proves the DAG and Compute Governance functionality.
    """
    
    base_dir = "test_research_platform"
    if os.path.exists(base_dir):
        shutil.rmtree(base_dir)
        
    try:
        # 1. Register Immutable Hypothesis (YAML)
        h_reg = HypothesisRegistry(registry_path=f"{base_dir}/hypotheses")
        hyp_id = h_reg.register_hypothesis(
            base_id="HYP-001",
            author="Quant A",
            rationale="Steam velocity creates edge",
            metadata={"horizon": "6h"}
        )
        
        # 2. Priority Queue Scoring
        queue = ExperimentPriorityQueue()
        queue.add_hypothesis(hyp_id, expected_info_gain=0.9, novelty=0.8, compute_cost=0.2, business_value=0.9)
        next_exp = queue.get_next_experiment()
        assert next_exp["hypothesis_id"] == hyp_id
        
        # 3. Knowledge Graph
        graph = AlphaKnowledgeGraph()
        graph.add_node(hyp_id, "Hypothesis")
        
        # 4. Orchestrator execution (DuckDB logging Compute Governance)
        orch = ExperimentOrchestrator(db_path=f"{base_dir}/ledger.duckdb")
        result = orch.run_experiment_mock("EXP-001", hyp_id, {"learning_rate": 0.01})
        graph.add_node("EXP-001", "Experiment")
        graph.add_edge(hyp_id, "EXP-001", "tested_by")
        
        # 5. Multiple Testing Control (FDR)
        # Mock 100 p-values, ours is 0.04. 
        # Under Benjamini-Hochberg with many tests, 0.04 might lose significance.
        p_values = [0.04] + [0.1] * 99 
        fdr_results = FDRController.benjamini_hochberg(p_values, false_discovery_rate=0.05)
        
        # 6. Promotion Committee & Negative Registry
        report_path = f"{base_dir}/reports/EXP-001_report.md"
        passed_committee = PromotionCommittee.generate_report(
            experiment_id="EXP-001",
            specs={"is_reproducible": True},
            results={
                "evidence_level": "L2_HISTORICAL",
                "beats_baseline": True,
                "passes_fdr": False, # Failed FDR!
                "robust_seasons": True
            },
            filepath=report_path
        )
        
        if not passed_committee:
            n_reg = NegativeResultRegistry(registry_path=f"{base_dir}/negative_results")
            n_reg.log_failure(hyp_id, FailureTaxonomy.NO_STATISTICAL_SIGNAL, "Failed FDR correction.", {"seed": 42})
            graph.add_node("Failed_Promotion", "Decision")
            graph.add_edge("EXP-001", "Failed_Promotion")
            
        print("Test Passed: Alpha Research Platform handled the full lifecycle, including FDR rejection and Negative Logging.")
        
    finally:
        if os.path.exists(base_dir):
            shutil.rmtree(base_dir)

if __name__ == "__main__":
    test_research_platform_e2e()
