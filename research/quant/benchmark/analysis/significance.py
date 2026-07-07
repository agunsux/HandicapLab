import numpy as np
import pandas as pd
from typing import Tuple, List, Dict

class SignificanceEngine:
    def __init__(self, config_path: str = None):
        # Default parameters
        self.iterations = 1000
        self.confidence = 0.95
        self.alpha = 0.05
        self.block_size = 10 # Default block size for Moving Block Bootstrap
        
        # Load from config if available (placeholder logic)
        if config_path:
            import yaml
            try:
                with open(config_path, 'r') as f:
                    cfg = yaml.safe_load(f).get('research', {}).get('bootstrap', {})
                    self.iterations = cfg.get('iterations', self.iterations)
                    self.confidence = cfg.get('confidence', self.confidence)
                    self.alpha = cfg.get('alpha', self.alpha)
            except Exception as e:
                pass
                
    def _moving_block_bootstrap(self, array: np.ndarray) -> np.ndarray:
        """
        Performs Moving Block Bootstrap to preserve time-series dependencies.
        Returns a resampled array of the same length.
        """
        n = len(array)
        if n == 0:
            return array
            
        resampled = np.zeros(n)
        num_blocks = int(np.ceil(n / self.block_size))
        
        # Calculate valid starting indices for blocks
        # to avoid out-of-bounds, the max start index is n - block_size
        max_start_idx = max(1, n - self.block_size + 1)
        
        current_idx = 0
        for _ in range(num_blocks):
            start_idx = np.random.randint(0, max_start_idx)
            end_idx = min(start_idx + self.block_size, n)
            chunk_size = end_idx - start_idx
            
            # If we are near the end, only take what's needed to fill array
            take_size = min(chunk_size, n - current_idx)
            resampled[current_idx:current_idx + take_size] = array[start_idx:start_idx + take_size]
            current_idx += take_size
            
            if current_idx >= n:
                break
                
        return resampled

    def bootstrap_ci(self, returns_array: np.ndarray, metric_func=np.sum) -> Tuple[float, float, float]:
        """
        Calculates the Bootstrapped Confidence Interval for a metric (e.g., ROI).
        Returns (Metric Mean, Lower Bound, Upper Bound)
        """
        # ROI is sum of returns / number of bets. Assuming returns_array contains percentage return per bet.
        bootstrapped_metrics = []
        for _ in range(self.iterations):
            resampled = self._moving_block_bootstrap(returns_array)
            bootstrapped_metrics.append(metric_func(resampled))
            
        bootstrapped_metrics = np.array(bootstrapped_metrics)
        mean_metric = np.mean(bootstrapped_metrics)
        
        lower_percentile = ((1.0 - self.confidence) / 2.0) * 100
        upper_percentile = (self.confidence + ((1.0 - self.confidence) / 2.0)) * 100
        
        lower_bound = np.percentile(bootstrapped_metrics, lower_percentile)
        upper_bound = np.percentile(bootstrapped_metrics, upper_percentile)
        
        return float(mean_metric), float(lower_bound), float(upper_bound)

    def cohens_d(self, group1: np.ndarray, group2: np.ndarray) -> float:
        """
        Calculates Cohen's d effect size between two groups.
        """
        n1, n2 = len(group1), len(group2)
        if n1 < 2 or n2 < 2:
            return 0.0
            
        var1, var2 = np.var(group1, ddof=1), np.var(group2, ddof=1)
        
        # Pooled standard deviation
        pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
        if pooled_std == 0:
            return 0.0
            
        mean1, mean2 = np.mean(group1), np.mean(group2)
        return float((mean1 - mean2) / pooled_std)

    def benjamini_hochberg_fdr(self, p_values: List[float]) -> List[bool]:
        """
        Applies Benjamini-Hochberg False Discovery Rate correction.
        Returns a boolean list indicating which hypotheses remain significant.
        """
        n = len(p_values)
        if n == 0:
            return []
            
        # Sort p-values and keep track of original indices
        sorted_indices = np.argsort(p_values)
        sorted_p = np.array(p_values)[sorted_indices]
        
        significant = [False] * n
        
        # Find the largest k such that p_k <= (k/n) * alpha
        max_k = -1
        for i in range(n):
            k = i + 1
            threshold = (k / n) * self.alpha
            if sorted_p[i] <= threshold:
                max_k = i
                
        # If a max_k is found, all p-values up to max_k are considered significant
        if max_k >= 0:
            for i in range(max_k + 1):
                original_idx = sorted_indices[i]
                significant[original_idx] = True
                
        return significant

    def bayesian_model_comparison_placeholder(self, model_a_results: np.ndarray, model_b_results: np.ndarray) -> Dict:
        """
        Placeholder for future sprint (Bayesian Factor, Posterior Probability).
        """
        return {
            "bayes_factor": "Not Implemented",
            "posterior_probability_a_better_b": "Not Implemented",
            "credible_interval": "Not Implemented"
        }
