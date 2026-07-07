import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss

def calculate_brier_score(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """
    Calculates multi-class Brier Score.
    y_true: 1D array of labels (0, 1, 2)
    y_prob: 2D array of probabilities [N, 3]
    """
    # Convert labels to one-hot
    y_true_onehot = pd.get_dummies(y_true).values
    
    # Brier Score for multi-class is often calculated as the mean squared difference
    # across all classes and all instances.
    return np.mean(np.sum((y_prob - y_true_onehot) ** 2, axis=1))

def calculate_log_loss(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    return log_loss(y_true, y_prob)

def calculate_ece(y_true: np.ndarray, y_prob: np.ndarray, bins=10) -> float:
    """
    Expected Calibration Error (ECE).
    Calculates the weighted average of the absolute difference between accuracy and confidence in each bin.
    """
    confidences = np.max(y_prob, axis=1)
    predictions = np.argmax(y_prob, axis=1)
    accuracies = (predictions == y_true)
    
    bin_boundaries = np.linspace(0, 1, bins + 1)
    ece = 0.0
    
    for i in range(bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i+1]
        
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
            
    return float(ece)
