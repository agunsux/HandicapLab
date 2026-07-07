import numpy as np
import pandas as pd
from .base import BaseModel

class AlwaysBetHome(BaseModel):
    def __init__(self):
        super().__init__("AlwaysBetHome")
        
    def fit(self, X: pd.DataFrame, y: np.ndarray):
        pass
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        # 100% Home, 0% Draw, 0% Away
        probs = np.zeros((len(X), 3))
        probs[:, 0] = 1.0
        return probs

class AlwaysBetFavourite(BaseModel):
    def __init__(self):
        super().__init__("AlwaysBetFavourite")
        
    def fit(self, X: pd.DataFrame, y: np.ndarray):
        pass
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        # We need odds data to determine the favourite
        probs = np.zeros((len(X), 3))
        
        # Determine odds columns
        if 'odds_pinnacle_1' in X.columns:
            bookie = 'pinnacle'
        elif 'odds_bet365_1' in X.columns:
            bookie = 'bet365'
        else:
            # Fallback to home win if no odds
            probs[:, 0] = 1.0
            return probs
            
        o1 = X[f'odds_{bookie}_1'].values
        ox = X[f'odds_{bookie}_x'].values
        o2 = X[f'odds_{bookie}_2'].values
        
        # 0: Home, 1: Draw, 2: Away
        for i in range(len(X)):
            if np.isnan(o1[i]) or np.isnan(o2[i]):
                probs[i, 0] = 1.0 # fallback
                continue
                
            odds_arr = np.array([o1[i], ox[i], o2[i]])
            fav_idx = np.argmin(odds_arr)
            probs[i, fav_idx] = 1.0
            
        return probs
