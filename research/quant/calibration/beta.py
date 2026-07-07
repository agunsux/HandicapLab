import numpy as np
from scipy.optimize import minimize
from sklearn.base import BaseEstimator, RegressorMixin

class BetaCalibration(BaseEstimator, RegressorMixin):
    """
    Internal Beta Calibration implementation using scipy.optimize.
    Based on Kull et al. (2017) "Beta calibration: a well-founded and easily implemented improvement on logistic calibration for binary classifiers"
    Model: P(Y=1|P) = 1 / (1 + 1 / (e^c * P^a / (1-P)^b))
    We fit parameters a, b, c to minimize log loss.
    """
    def __init__(self):
        self.a_ = 1.0
        self.b_ = 1.0
        self.c_ = 0.0

    def fit(self, probs, y):
        probs = np.clip(probs, 1e-15, 1 - 1e-15)
        
        def loss(params):
            a, b, c = params
            # Beta calibration transformation
            # log(odds_calib) = a * log(p) - b * log(1-p) + c
            log_odds = a * np.log(probs) - b * np.log(1 - probs) + c
            # To probabilities
            calibrated_p = 1 / (1 + np.exp(-log_odds))
            calibrated_p = np.clip(calibrated_p, 1e-15, 1 - 1e-15)
            # Log loss
            ll = -np.mean(y * np.log(calibrated_p) + (1 - y) * np.log(1 - calibrated_p))
            return ll

        # Initial guess: a=1, b=1, c=0 (identity mapping)
        initial_params = [1.0, 1.0, 0.0]
        # Bounds: a and b must be >= 0
        bounds = [(0, None), (0, None), (None, None)]
        
        res = minimize(loss, initial_params, bounds=bounds, method='L-BFGS-B')
        self.a_, self.b_, self.c_ = res.x
        return self

    def predict_proba(self, probs):
        probs = np.clip(probs, 1e-15, 1 - 1e-15)
        log_odds = self.a_ * np.log(probs) - self.b_ * np.log(1 - probs) + self.c_
        calibrated_p = 1 / (1 + np.exp(-log_odds))
        return calibrated_p
