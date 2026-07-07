import numpy as np
from typing import List, Dict, Any

class FDRController:
    """
    Multiple Testing Control to prevent p-hacking when running massive grids of hyperparameters.
    """
    
    @staticmethod
    def benjamini_hochberg(p_values: List[float], false_discovery_rate: float = 0.05) -> Dict[str, Any]:
        """
        Applies Benjamini-Hochberg procedure to a list of p-values.
        Returns which hypotheses are still significant after correction.
        """
        if not p_values:
            return {"adjusted_threshold": false_discovery_rate, "significant_indices": []}
            
        m = len(p_values)
        p_values = np.array(p_values)
        
        # Sort p-values
        sorted_indices = np.argsort(p_values)
        sorted_p_values = p_values[sorted_indices]
        
        # Calculate BH thresholds
        thresholds = (np.arange(1, m + 1) / m) * false_discovery_rate
        
        # Find the largest k where p_k <= threshold_k
        significant = sorted_p_values <= thresholds
        
        if not any(significant):
            return {"adjusted_threshold": thresholds[0], "significant_indices": []}
            
        max_significant_index = np.where(significant)[0][-1]
        
        # All p-values up to this index are considered significant
        sig_indices = sorted_indices[:max_significant_index + 1].tolist()
        
        return {
            "adjusted_threshold": thresholds[max_significant_index],
            "significant_indices": sig_indices
        }
