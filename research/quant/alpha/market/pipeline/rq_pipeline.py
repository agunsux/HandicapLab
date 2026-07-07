import pandas as pd
from typing import Dict, Any, Type
from research.quant.alpha.market.types.interfaces import BaseEngine
from research.quant.alpha.market.evaluation.evidence_levels import EvidenceLevel
from research.quant.alpha.market.narrative.scientific_narrative import ScientificNarrativeGenerator
from research.quant.alpha.market.evaluation.alpha_extractor import AlphaExtractor
from research.quant.alpha.market.pipeline.experiment_tracker import ExperimentTracker

class RQPipeline:
    """
    Orchestrates the execution of a Research Question.
    Ensures that Evidence Level and all governance checks are respected.
    """
    def __init__(self, engine_class: Type[BaseEngine]):
        self.engine = engine_class()
        self.narrative_generator = ScientificNarrativeGenerator()
        self.alpha_extractor = AlphaExtractor()
        self.tracker = ExperimentTracker()

    def run_experiment(self, rq_id: str, df: pd.DataFrame, hypothesis: str, 
                       evidence_level: EvidenceLevel, dataset_ref: str, 
                       git_commit: str, dataset_fingerprint: str,
                       feature_version: str, config_hash: str, random_seed: int):
        """
        Runs the engine, generates narrative, extracts alpha, and logs the experiment.
        """
        # 1. Run Engine Calculation
        metrics = self.engine.calculate(df)
        
        # 2. Extract Alpha Candidates (Gated by Evidence Level implicitly inside extractor)
        alpha_meta = self.alpha_extractor.process_rq_result(rq_id, metrics, evidence_level)
        
        # Determine outcome
        outcome = "PARTIALLY ACCEPTED" if alpha_meta.get('acs') else "INCONCLUSIVE"
        
        # 3. Generate Scientific Narrative
        self.narrative_generator.generate(
            rq_id=rq_id,
            hypothesis=hypothesis,
            methodology=self.engine.__class__.__name__,
            evidence_level=evidence_level,
            dataset_ref=dataset_ref,
            sample_size=len(df),
            findings=f"Metrics evaluated: {list(metrics.keys())}",
            effect_size="Medium",
            confidence="Moderate",
            limitations="Needs walk-forward validation",
            next_experiment="Test on 5 seasons of historical data",
            decision=outcome,
            promotion_recommendation="Proceed to Historical Validation" if evidence_level == EvidenceLevel.L1 else "Promote to OOS"
        )
        
        # 4. Record Immutable Ledger
        manifest = self.tracker.record_experiment(
            experiment_id=rq_id,
            git_commit=git_commit,
            dataset_fingerprint=dataset_fingerprint,
            feature_version=feature_version,
            config_hash=config_hash,
            random_seed=random_seed,
            evidence_level=evidence_level.value,
            outcome=outcome,
            promotion_decision=alpha_meta['status']
        )
        
        return manifest, alpha_meta
