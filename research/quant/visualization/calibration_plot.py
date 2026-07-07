import matplotlib.pyplot as plt
import numpy as np
from sklearn.calibration import calibration_curve

def plot_calibration_curve(y_true, y_prob, name, ax=None, n_bins=10):
    if ax is None:
        fig, ax = plt.subplots(figsize=(8, 8))
    else:
        fig = ax.figure
        
    prob_true, prob_pred = calibration_curve(y_true, y_prob, n_bins=n_bins)
    
    ax.plot([0, 1], [0, 1], "k:", label="Perfectly calibrated")
    ax.plot(prob_pred, prob_true, "s-", label=f"{name}")
    
    ax.set_ylabel("Fraction of positives")
    ax.set_xlabel("Mean predicted value")
    ax.set_title("Reliability Diagram")
    ax.legend(loc="lower right")
    
    return fig

def plot_confidence_histogram(y_prob, name, ax=None, n_bins=10):
    if ax is None:
        fig, ax = plt.subplots(figsize=(8, 4))
    else:
        fig = ax.figure
        
    ax.hist(y_prob, range=(0, 1), bins=n_bins, label=name, histtype="step", lw=2)
    ax.set_xlabel("Mean predicted value")
    ax.set_ylabel("Count")
    ax.set_title("Confidence Histogram")
    ax.legend(loc="upper center", ncol=2)
    
    return fig

def generate_calibration_report(y_true, dict_of_probs, filepath):
    """
    Generates a combined plot for multiple models/calibrations.
    """
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 12), gridspec_kw={'height_ratios': [3, 1]})
    
    for name, y_prob in dict_of_probs.items():
        plot_calibration_curve(y_true, y_prob, name, ax=ax1)
        plot_confidence_histogram(y_prob, name, ax=ax2)
        
    plt.tight_layout()
    plt.savefig(filepath)
    plt.close()
