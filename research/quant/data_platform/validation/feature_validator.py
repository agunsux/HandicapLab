import pandas as pd
import numpy as np
from scipy.stats import ks_2samp

class FeatureValidator:
    """
    Validates features for drift, variance collapse, and temporal stability across seasons.
    """
    
    @staticmethod
    def check_temporal_stability(df: pd.DataFrame, feature_col: str, season_col: str = 'season', p_value_threshold: float = 0.05):
        """
        Performs a Kolmogorov-Smirnov test between consecutive seasons.
        If the distributions change drastically, it throws a warning or error.
        """
        seasons = sorted(df[season_col].unique())
        
        for i in range(len(seasons) - 1):
            s1 = df[df[season_col] == seasons[i]][feature_col].dropna()
            s2 = df[df[season_col] == seasons[i+1]][feature_col].dropna()
            
            if len(s1) < 50 or len(s2) < 50:
                continue # Not enough data to compare
                
            statistic, p_value = ks_2samp(s1, s2)
            
            if p_value < p_value_threshold:
                print(f"TEMPORAL STABILITY WARNING: Feature '{feature_col}' drifted significantly between {seasons[i]} and {seasons[i+1]} (p={p_value:.4f})")
                return False
                
        return True
        
    @staticmethod
    def check_variance_collapse(df: pd.DataFrame, feature_col: str):
        """
        Detects if a feature is constant or has near-zero variance.
        """
        if df[feature_col].nunique() <= 1 or df[feature_col].std() < 1e-6:
            raise ValueError(f"VARIANCE COLLAPSE: Feature '{feature_col}' is constant.")
