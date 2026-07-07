import numpy as np
from typing import Dict, Any

class StatisticalValidator:
    """
    Applies rigorous statistical tests to ensure results are not just due to chance.
    """
    
    @staticmethod
    def bootstrap_confidence_interval(data: np.ndarray, n_iterations: int = 1000, alpha: float = 0.05) -> Dict[str, float]:
        """
        Computes the bootstrap confidence interval for the mean of the data.
        """
        if len(data) == 0:
            return {"lower": 0.0, "upper": 0.0, "mean": 0.0}
            
        means = np.zeros(n_iterations)
        for i in range(n_iterations):
            sample = np.random.choice(data, size=len(data), replace=True)
            means[i] = np.mean(sample)
            
        lower_percentile = (alpha / 2) * 100
        upper_percentile = (1 - alpha / 2) * 100
        
        return {
            "mean": np.mean(means),
            "lower_bound": np.percentile(means, lower_percentile),
            "upper_bound": np.percentile(means, upper_percentile),
            "iterations": n_iterations
        }
