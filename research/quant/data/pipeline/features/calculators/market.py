import pandas as pd
from ..base import BaseFeatureGenerator, temporal_guard

class ImpliedProbability(BaseFeatureGenerator):
    feature_name = 'implied_probability'
    
    @temporal_guard
    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates implied probability from odds and bookmaker margin (vig).
        Available PRE-KICKOFF (lag=0).
        """
        result = pd.DataFrame(index=df.index)
        
        # Determine odds columns (fallback mechanism)
        if 'odds_pinnacle_1' in df.columns:
            bookie = 'pinnacle'
        elif 'odds_bet365_1' in df.columns:
            bookie = 'bet365'
        else:
            # Cannot calculate without odds
            return result
            
        o1 = df[f'odds_{bookie}_1']
        ox = df[f'odds_{bookie}_x']
        o2 = df[f'odds_{bookie}_2']
        
        # Margin (Vig)
        margin = (1/o1) + (1/ox) + (1/o2)
        
        # True Probability (Vig-removed)
        result['market_implied_prob_home'] = (1/o1) / margin
        result['market_implied_prob_draw'] = (1/ox) / margin
        result['market_implied_prob_away'] = (1/o2) / margin
        result['market_margin'] = margin - 1.0
        
        return result
