import pytest
import pandas as pd
import numpy as np
from pathlib import Path
import sys
import hashlib

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evaluation.metrics import get_all_metrics
from calibration.factory import get_calibrator

def load_golden():
    golden_path = Path(__file__).parent / "data" / "golden_dataset.parquet"
    df = pd.read_parquet(golden_path)
    df['target_home_win'] = (df['home_goals'] > df['away_goals']).astype(int)
    total_implied = (1/df['odds_home']) + (1/df['odds_draw']) + (1/df['odds_away'])
    df['prob_home_bookie_true'] = (1/df['odds_home']) / total_implied
    return df

def test_golden_metrics_platt():
    df = load_golden()
    
    y = df['target_home_win'].values
    p_bookie = df['prob_home_bookie_true'].values
    
    # 50-50 split
    y_train, y_test = y[:100], y[100:]
    p_train, p_test = p_bookie[:100], p_bookie[100:]
    
    calibrator = get_calibrator('platt')
    calibrator.fit(p_train, y_train)
    p_calib = calibrator.predict_proba(p_test)
    
    metrics = get_all_metrics(y_test, p_calib)
    
    assert np.isclose(metrics['logloss'], 0.6892473563103713, atol=1e-8, rtol=1e-6)
    assert np.isclose(metrics['brier'], 0.24804655388453056, atol=1e-8, rtol=1e-6)
    assert np.isclose(metrics['ece'], 0.009726889725151955, atol=1e-8, rtol=1e-6)
    
def test_golden_metrics_isotonic():
    df = load_golden()
    
    y = df['target_home_win'].values
    p_bookie = df['prob_home_bookie_true'].values
    
    y_train, y_test = y[:100], y[100:]
    p_train, p_test = p_bookie[:100], p_bookie[100:]
    
    calibrator = get_calibrator('isotonic')
    calibrator.fit(p_train, y_train)
    p_calib = calibrator.predict_proba(p_test)
    
    metrics = get_all_metrics(y_test, p_calib)
    assert np.isclose(metrics['logloss'], 0.6355803414964739, atol=1e-8, rtol=1e-6)
    assert np.isclose(metrics['brier'], 0.2283247676611521, atol=1e-8, rtol=1e-6)
    assert np.isclose(metrics['ece'], 0.024024943557910367, atol=1e-8, rtol=1e-6)

def test_golden_metrics_beta():
    df = load_golden()
    
    y = df['target_home_win'].values
    p_bookie = df['prob_home_bookie_true'].values
    
    y_train, y_test = y[:100], y[100:]
    p_train, p_test = p_bookie[:100], p_bookie[100:]
    
    calibrator = get_calibrator('beta')
    calibrator.fit(p_train, y_train)
    p_calib = calibrator.predict_proba(p_test)
    
    metrics = get_all_metrics(y_test, p_calib)
    assert np.isclose(metrics['logloss'], 0.6883414220627105, atol=1e-8, rtol=1e-6)
    assert np.isclose(metrics['brier'], 0.2476000006121408, atol=1e-8, rtol=1e-6)
    assert np.isclose(metrics['ece'], 0.010000030606990506, atol=1e-8, rtol=1e-6)
