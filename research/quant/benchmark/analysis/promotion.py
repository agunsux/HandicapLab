import pandas as pd
from typing import Dict, Tuple

class PromotionGate:
    def __init__(self):
        self.min_predictions = 500
        self.min_seasons = 5
        self.min_leagues = 5
        self.min_odds_coverage = 0.90
        
    def evaluate(self, 
                 df: pd.DataFrame, 
                 roi_mean: float, 
                 roi_lower_ci: float, 
                 effect_size: float, 
                 baseline_roi: float) -> Tuple[bool, str]:
        """
        Ultimate gatekeeper for Champion promotion.
        """
        reasons = []
        
        # 1. Minimum Sample Size checks
        num_preds = len(df)
        if num_preds < self.min_predictions:
            reasons.append(f"FAILED: Sample size ({num_preds}) < {self.min_predictions}")
            
        if 'year' in df.columns:
            num_seasons = df['year'].nunique()
            if num_seasons < self.min_seasons:
                reasons.append(f"FAILED: Seasons coverage ({num_seasons}) < {self.min_seasons}")
                
        if 'league_id' in df.columns:
            num_leagues = df['league_id'].nunique()
            if num_leagues < self.min_leagues:
                reasons.append(f"FAILED: Leagues coverage ({num_leagues}) < {self.min_leagues}")
                
        # 2. ROI Checks
        if roi_mean <= baseline_roi:
            reasons.append(f"FAILED: ROI ({roi_mean:.2f}%) did not beat baseline ({baseline_roi:.2f}%)")
            
        # 3. Confidence Interval Check
        if roi_lower_ci <= 0.0:
            reasons.append(f"FAILED: ROI Lower Bound CI ({roi_lower_ci:.2f}%) is <= 0.0")
            
        # 4. Effect Size Minimum
        # Cohen's d threshold: 0.2 small, 0.5 medium. We want at least a small effect to avoid negligible noise bumps.
        min_effect_size = 0.10
        if effect_size < min_effect_size:
            reasons.append(f"FAILED: Effect Size ({effect_size:.4f}) < {min_effect_size}")
            
        if len(reasons) > 0:
            return False, " | ".join(reasons)
            
        return True, "PASSED all promotion gates."
