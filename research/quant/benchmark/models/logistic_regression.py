import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression as SklearnLR
from sklearn.preprocessing import StandardScaler
from .base import BaseModel

class LogisticRegression(BaseModel):
    def __init__(self, C=1.0):
        super().__init__("LogisticRegression")
        self.model = SklearnLR(C=C, max_iter=1000)
        self.scaler = StandardScaler()
        self.features = None
        
    def fit(self, X: pd.DataFrame, y: np.ndarray):
        # Determine features (drop UUIDs and non-numerics)
        self.features = [c for c in X.columns if X[c].dtype in ['float64', 'int64'] and not c.endswith('_id')]
        
        X_train = X[self.features].fillna(0).values
        X_train_scaled = self.scaler.fit_transform(X_train)
        
        self.model.fit(X_train_scaled, y)
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if not self.features:
            raise ValueError("Model not fitted.")
            
        X_test = X[self.features].fillna(0).values
        X_test_scaled = self.scaler.transform(X_test)
        
        return self.model.predict_proba(X_test_scaled)
