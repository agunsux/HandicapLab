import pytest
import pandas as pd
import numpy as np
from research.quant.benchmark.evaluation.profitability import calculate_roi
from research.quant.benchmark.evaluation.calibration import calculate_brier_score

def test_random_predictor():
    np.random.seed(42)
    n = 1000
    df = pd.DataFrame({
        'result': np.random.randint(0, 3, size=n),
        'bet_on': np.random.randint(0, 3, size=n),
        'odds_home': np.full(n, 3.0),
        'odds_draw': np.full(n, 3.0),
        'odds_away': np.full(n, 3.0)
    })
    
    roi = calculate_roi(df)
    # A random predictor on fair odds (3.0 for 3 outcomes) should have an ROI near 0
    assert abs(roi) < 10.0 # It should be close to 0, bounding by 10%

def test_perfect_predictor():
    n = 100
    df = pd.DataFrame({
        'result': [0, 1, 2] * 33 + [0],
        'bet_on': [0, 1, 2] * 33 + [0],
        'odds_home': np.full(n, 2.0),
        'odds_draw': np.full(n, 2.0),
        'odds_away': np.full(n, 2.0)
    })
    
    roi = calculate_roi(df)
    # 100% win rate at odds 2.0 = 100% ROI
    assert roi == 100.0
    
    # Perfect probability matrix
    y_true = df['result'].values
    y_prob = np.zeros((n, 3))
    for i, res in enumerate(y_true):
        y_prob[i, res] = 1.0
        
    brier = calculate_brier_score(y_true, y_prob)
    assert brier == 0.0
