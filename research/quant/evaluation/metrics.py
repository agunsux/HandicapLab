import numpy as np
from sklearn.metrics import brier_score_loss, log_loss

def calculate_ece(y_true, y_prob, n_bins=10):
    """Expected Calibration Error"""
    bins = np.linspace(0., 1., n_bins + 1)
    binids = np.digitize(y_prob, bins) - 1
    
    ece = 0.0
    for i in range(n_bins):
        bin_mask = (binids == i)
        if np.any(bin_mask):
            prob_pred = np.mean(y_prob[bin_mask])
            prob_true = np.mean(y_true[bin_mask])
            ece += (np.sum(bin_mask) / len(y_prob)) * np.abs(prob_pred - prob_true)
    return ece

def calculate_mce(y_true, y_prob, n_bins=10):
    """Maximum Calibration Error"""
    bins = np.linspace(0., 1., n_bins + 1)
    binids = np.digitize(y_prob, bins) - 1
    
    mce = 0.0
    for i in range(n_bins):
        bin_mask = (binids == i)
        if np.any(bin_mask):
            prob_pred = np.mean(y_prob[bin_mask])
            prob_true = np.mean(y_true[bin_mask])
            mce = max(mce, np.abs(prob_pred - prob_true))
    return mce

def calculate_adaptive_ece(y_true, y_prob, n_bins=10):
    """Adaptive ECE using quantiles"""
    quantiles = np.linspace(0, 1, n_bins + 1)
    bins = np.quantile(y_prob, quantiles)
    # Ensure bins are unique (can happen with many identical predictions)
    bins = np.unique(bins)
    if len(bins) < 2:
        return 0.0 # Perfectly sharp or trivial
        
    binids = np.digitize(y_prob, bins) - 1
    
    ece = 0.0
    for i in range(len(bins)-1):
        bin_mask = (binids == i)
        if np.any(bin_mask):
            prob_pred = np.mean(y_prob[bin_mask])
            prob_true = np.mean(y_true[bin_mask])
            ece += (np.sum(bin_mask) / len(y_prob)) * np.abs(prob_pred - prob_true)
    return ece

def calculate_sharpness(y_prob):
    """Variance of predictions (higher is sharper)"""
    return np.var(y_prob)

def get_all_metrics(y_true, y_prob):
    return {
        'logloss': log_loss(y_true, y_prob),
        'brier': brier_score_loss(y_true, y_prob),
        'ece': calculate_ece(y_true, y_prob),
        'mce': calculate_mce(y_true, y_prob),
        'adaptive_ece': calculate_adaptive_ece(y_true, y_prob),
        'sharpness': calculate_sharpness(y_prob)
    }
