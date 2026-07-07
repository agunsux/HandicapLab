import pandas as pd
import numpy as np
from abc import ABC, abstractmethod

class BaseModel(ABC):
    def __init__(self, name: str):
        self.name = name
        
    @abstractmethod
    def fit(self, X: pd.DataFrame, y: np.ndarray):
        pass
        
    @abstractmethod
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """
        Returns a 2D numpy array [N, 3] representing probabilities for:
        [Home_Win, Draw, Away_Win]
        """
        pass
