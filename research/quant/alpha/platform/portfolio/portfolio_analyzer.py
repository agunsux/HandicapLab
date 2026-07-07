import numpy as np
from typing import Dict, Any

class AlphaPortfolioAnalyzer:
    """
    Analyzes the correlation and overlap of a new Alpha against the existing Portfolio.
    """
    
    @staticmethod
    def check_correlation(new_alpha_returns: np.ndarray, existing_alpha_returns: np.ndarray, threshold: float = 0.8) -> bool:
        """
        Checks if the new alpha is too highly correlated with an existing one.
        """
        if len(new_alpha_returns) == 0 or len(existing_alpha_returns) == 0:
            return True
            
        corr = np.corrcoef(new_alpha_returns, existing_alpha_returns)[0, 1]
        
        if corr > threshold:
            print(f"PORTFOLIO REJECTION: Alpha correlation is {corr:.2f}, exceeding threshold {threshold}.")
            return False
            
        return True
