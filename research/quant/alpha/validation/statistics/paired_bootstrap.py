import numpy as np

class PairedBootstrap:
    """
    Paired Bootstrap for building Confidence Intervals without assuming normality.
    """
    
    @staticmethod
    def confidence_interval(metric_values: np.ndarray, n_bootstraps: int = 1000, alpha: float = 0.05) -> dict:
        """
        Calculates the (alpha/2) and (1 - alpha/2) percentiles.
        """
        bootstrapped_means = []
        n = len(metric_values)
        
        if n == 0:
            return {"lower_bound": 0.0, "upper_bound": 0.0, "mean": 0.0}
            
        for _ in range(n_bootstraps):
            sample = np.random.choice(metric_values, size=n, replace=True)
            bootstrapped_means.append(np.mean(sample))
            
        lower_bound = np.percentile(bootstrapped_means, (alpha / 2) * 100)
        upper_bound = np.percentile(bootstrapped_means, (1 - alpha / 2) * 100)
        
        return {
            "lower_bound": float(lower_bound),
            "upper_bound": float(upper_bound),
            "mean": float(np.mean(metric_values))
        }
