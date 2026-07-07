from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression
from .beta import BetaCalibration

def get_calibrator(method_name: str):
    """
    Returns an instantiated calibrator object that implements fit(probs, y) and predict_proba(probs).
    """
    if method_name == 'platt':
        # Platt scaling using LogisticRegression. We need to expand dims for sklearn
        class PlattScaler:
            def __init__(self):
                self.model = LogisticRegression(solver='lbfgs')
            def fit(self, probs, y):
                self.model.fit(probs.reshape(-1, 1), y)
                return self
            def predict_proba(self, probs):
                return self.model.predict_proba(probs.reshape(-1, 1))[:, 1]
        return PlattScaler()
        
    elif method_name == 'isotonic':
        class IsotonicScaler:
            def __init__(self):
                self.model = IsotonicRegression(out_of_bounds='clip', y_min=0, y_max=1)
            def fit(self, probs, y):
                self.model.fit(probs, y)
                return self
            def predict_proba(self, probs):
                return self.model.predict(probs)
        return IsotonicScaler()
        
    elif method_name == 'beta':
        return BetaCalibration()
        
    else:
        raise ValueError(f"Unknown calibration method: {method_name}")
