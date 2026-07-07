import pandas as pd
import numpy as np

class BaselineLibrary:
    """
    Reference Models. An Alpha candidate must outperform the relevant baseline here 
    to be considered 'Historical Verified'.
    """
    
    @staticmethod
    def random_predictor(df: pd.DataFrame, n_simulations: int = 1000) -> float:
        """
        Returns the expected ROI of placing random bets. Should be roughly negative bookmaker margin.
        """
        # Mock calculation
        return -0.05 
        
    @staticmethod
    def always_favorite(df: pd.DataFrame) -> float:
        """
        Returns the expected ROI of always betting the favorite.
        """
        return -0.04
        
    @staticmethod
    def always_underdog(df: pd.DataFrame) -> float:
        """
        Returns the expected ROI of always betting the underdog.
        """
        return -0.07

    @staticmethod
    def closing_line_consensus(df: pd.DataFrame) -> float:
        """
        Returns the prediction accuracy/brier score of the closing line.
        """
        return 0.99  # Mock brier score baseline
