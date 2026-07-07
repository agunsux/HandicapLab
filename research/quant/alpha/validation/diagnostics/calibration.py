import numpy as np
from sklearn.metrics import brier_score_loss

class ProbabilityDiagnostics:
    """
    Evaluates whether raw probabilities are truly calibrated.
    Required before sizing positions with Kelly Criterion.
    """
    
    @staticmethod
    def calculate_brier_and_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> dict:
        """
        Calculates Brier Score and Expected Calibration Error (ECE).
        """
        # Brier Score
        if len(y_true) == 0:
            return {"brier_score": 0.0, "ece": 0.0}
            
        brier = brier_score_loss(y_true, y_prob)
        
        # Expected Calibration Error (ECE)
        bins = np.linspace(0., 1., n_bins + 1)
        binids = np.digitize(y_prob, bins) - 1
        
        ece = 0.0
        for i in range(n_bins):
            in_bin = binids == i
            if np.any(in_bin):
                prob_mean = np.mean(y_prob[in_bin])
                true_mean = np.mean(y_true[in_bin])
                ece += (np.sum(in_bin) / len(y_prob)) * np.abs(prob_mean - true_mean)
                
        return {
            "brier_score": float(brier),
            "ece": float(ece),
            "calibrated": bool(ece < 0.05) # Arbitrary strict institutional threshold
        }
