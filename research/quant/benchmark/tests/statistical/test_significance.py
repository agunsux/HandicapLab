import pytest
import numpy as np
from scipy import stats
from research.quant.benchmark.analysis.significance import SignificanceEngine

def test_cohens_d_accuracy():
    """
    Validates our Cohen's d implementation against a strict mathematical reference.
    Absolute error must be < 1e-6
    """
    np.random.seed(42)
    group1 = np.random.normal(0.5, 1.0, 100)
    group2 = np.random.normal(0.0, 1.0, 100)
    
    engine = SignificanceEngine()
    our_d = engine.cohens_d(group1, group2)
    
    # Mathematical reference for Cohen's d
    n1, n2 = len(group1), len(group2)
    var1, var2 = np.var(group1, ddof=1), np.var(group2, ddof=1)
    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    ref_d = (np.mean(group1) - np.mean(group2)) / pooled_std
    
    np.testing.assert_allclose(our_d, ref_d, rtol=1e-6, atol=1e-6)

def test_benjamini_hochberg():
    """
    Validates our BH FDR correction against statsmodels multipletests.
    """
    try:
        from statsmodels.stats.multitest import multipletests
    except ImportError:
        pytest.skip("statsmodels not installed")
        
    p_values = [0.001, 0.01, 0.04, 0.06, 0.1, 0.2]
    engine = SignificanceEngine()
    engine.alpha = 0.05
    
    our_sig = engine.benjamini_hochberg_fdr(p_values)
    
    reject, pvals_corrected, _, _ = multipletests(p_values, alpha=0.05, method='fdr_bh')
    ref_sig = reject.tolist()
    
    assert our_sig == ref_sig

def test_block_bootstrap_determinism():
    """
    Ensures that with a fixed seed, the moving block bootstrap is 100% reproducible.
    """
    engine = SignificanceEngine()
    engine.block_size = 3
    data = np.arange(100)
    
    np.random.seed(42)
    b1 = engine._moving_block_bootstrap(data)
    
    np.random.seed(42)
    b2 = engine._moving_block_bootstrap(data)
    
    np.testing.assert_array_equal(b1, b2)
