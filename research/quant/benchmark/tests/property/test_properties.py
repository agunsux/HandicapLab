import pytest
import numpy as np
from hypothesis import given, settings
from hypothesis.strategies import lists, floats
from research.quant.benchmark.analysis.significance import SignificanceEngine

@given(lists(floats(min_value=-100.0, max_value=100.0), min_size=10, max_size=100))
@settings(max_examples=50, deadline=None)
def test_bootstrap_ci_properties(returns):
    """
    Property-based test: Lower CI bound must be <= Mean <= Upper CI bound
    """
    engine = SignificanceEngine()
    engine.iterations = 50 # Lower iterations for speed during property testing
    
    returns_arr = np.array(returns)
    mean, lower, upper = engine.bootstrap_ci(returns_arr, metric_func=np.mean)
    
    assert lower <= mean
    assert mean <= upper

@given(lists(floats(min_value=0.0, max_value=1.0), min_size=5, max_size=50))
def test_bh_fdr_properties(p_values):
    """
    Property-based test: If a p-value is significant, any smaller p-value in the set must also be significant.
    """
    engine = SignificanceEngine()
    engine.alpha = 0.05
    
    significant = engine.benjamini_hochberg_fdr(p_values)
    
    # Check property
    p_arr = np.array(p_values)
    sig_arr = np.array(significant)
    
    # Max p-value that was rejected
    if np.any(sig_arr):
        max_sig_p = np.max(p_arr[sig_arr])
        # Any p-value smaller than max_sig_p must also be rejected
        assert np.all(sig_arr[p_arr <= max_sig_p])
