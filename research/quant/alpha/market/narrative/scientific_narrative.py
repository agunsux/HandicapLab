from pathlib import Path
from research.quant.alpha.market.evaluation.evidence_levels import EvidenceLevel

class ScientificNarrativeGenerator:
    """
    Generates a standardized Markdown report for an RQ (Scientific Deliverable).
    """
    def __init__(self, output_dir: str = "narratives"):
        base_dir = Path(__file__).parent
        self.output_dir = base_dir / output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate(self, rq_id: str, hypothesis: str, methodology: str, 
                 evidence_level: EvidenceLevel, dataset_ref: str, sample_size: int, 
                 findings: str, effect_size: str, confidence: str, limitations: str, 
                 next_experiment: str, decision: str, promotion_recommendation: str) -> str:
        
        # Banner for simulation
        banner = ""
        if evidence_level in [EvidenceLevel.L0, EvidenceLevel.L1]:
            banner = "> **SIMULATION ONLY — NOT RESEARCH EVIDENCE**\n\n"
            
        content = f"""{banner}# Research Question: {rq_id}

## Hypothesis
{hypothesis}

## Methodology
{methodology}

## Evidence Level
{evidence_level.value}

## Dataset
{dataset_ref}

## Sample Size
{sample_size}

## Findings
{findings}

## Effect Size
{effect_size}

## Confidence
{confidence}

## Limitations
{limitations}

## Next Experiment
{next_experiment}

## Decision
{decision}

## Promotion Recommendation
{promotion_recommendation}
"""
        
        filepath = self.output_dir / f"{rq_id}_narrative.md"
        with open(filepath, 'w') as f:
            f.write(content)
            
        return str(filepath)
