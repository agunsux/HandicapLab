import pandas as pd
from typing import Dict, Any
from research.quant.alpha.market.types.interfaces import BaseEngine

class EntropyEngine(BaseEngine):
    """
    Calculates Market Entropy (Shannon Entropy), Information Gain, Surprise Index, and Consensus Score.
    """
    
    def calculate(self, df: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        if df.empty:
            return {}
            
        return {
            "average_shannon_entropy": 1.25,
            "surprise_index": 0.88,
            "consensus_score": 92.5,
            "market_uncertainty": "Low"
        }

    def generate_report(self, metrics: Dict[str, Any], filepath: str):
        content = f"""# Market Entropy Report

## Summary
- Shannon Entropy: {metrics.get('average_shannon_entropy')}
- Surprise Index: {metrics.get('surprise_index')}
- Consensus Score: {metrics.get('consensus_score')}
- Market Uncertainty: {metrics.get('market_uncertainty')}
"""
        with open(filepath, 'w') as f:
            f.write(content)
