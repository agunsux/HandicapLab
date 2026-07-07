import numpy as np
from scipy import stats

def bootstrap_brier_ci(y_true, prob_baseline, prob_new, n_bootstraps=1000, alpha=0.05):
    """
    Computes the Bootstrap Confidence Interval for the difference in Brier Score.
    delta = Brier(baseline) - Brier(new)
    Positive delta means the new model is better.
    """
    y_true = np.asarray(y_true)
    prob_baseline = np.asarray(prob_baseline)
    prob_new = np.asarray(prob_new)
    
    n = len(y_true)
    deltas = []
    
    for _ in range(n_bootstraps):
        idx = np.random.randint(0, n, n)
        brier_base = np.mean((y_true[idx] - prob_baseline[idx])**2)
        brier_new = np.mean((y_true[idx] - prob_new[idx])**2)
        deltas.append(brier_base - brier_new)
        
    lower = np.percentile(deltas, 100 * (alpha / 2))
    upper = np.percentile(deltas, 100 * (1 - alpha / 2))
    
    return lower, upper, np.mean(deltas)

def paired_permutation_test(y_true, prob_baseline, prob_new, n_permutations=1000):
    """
    Paired permutation test for Brier Score difference.
    Null hypothesis: No difference in performance.
    """
    y_true = np.asarray(y_true)
    prob_baseline = np.asarray(prob_baseline)
    prob_new = np.asarray(prob_new)
    
    brier_base_ind = (y_true - prob_baseline)**2
    brier_new_ind = (y_true - prob_new)**2
    
    diffs = brier_base_ind - brier_new_ind
    obs_diff = np.mean(diffs)
    
    count_extreme = 0
    n = len(diffs)
    
    for _ in range(n_permutations):
        # randomly flip signs
        signs = np.random.choice([-1, 1], size=n)
        perm_diff = np.mean(diffs * signs)
        if abs(perm_diff) >= abs(obs_diff):
            count_extreme += 1
            
    p_value = count_extreme / n_permutations
    return obs_diff, p_value

def evaluate_decision_rule(baseline_brier, new_brier, lower_ci, upper_ci, p_value):
    """
    Evaluates the strict decision rules.
    Improvement = (baseline_brier - new_brier) / baseline_brier * 100
    """
    improvement = ((baseline_brier - new_brier) / baseline_brier) * 100
    
    if improvement < 0.5:
        return "REJECT", improvement
    
    if improvement >= 0.5 and lower_ci < 0:
        return "REVISIT", improvement
        
    if improvement >= 0.5 and lower_ci >= 0 and p_value < 0.05:
        return "ADOPT", improvement
        
    return "REVISIT", improvement
