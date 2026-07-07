import numpy as np
import pandas as pd
import lightgbm as lgb
from .base import BaseModel

class LightGBM(BaseModel):
    def __init__(self, n_estimators=100, learning_rate=0.1, max_depth=5):
        super().__init__("LightGBM")
        self.model = lgb.LGBMClassifier(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            max_depth=max_depth,
            objective='multiclass',
            random_state=42
        )
        self.features = None
        
    def fit(self, X: pd.DataFrame, y: np.ndarray):
        self.features = [c for c in X.columns if X[c].dtype in ['float64', 'int64'] and not c.endswith('_id')]
        
        X_train = X[self.features].values
        self.model.fit(X_train, y)
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if not self.features:
            raise ValueError("Model not fitted.")
            
        X_test = X[self.features].values
        return self.model.predict_proba(X_test)
