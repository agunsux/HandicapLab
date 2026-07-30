"""
models/sanity_check.py — DEPRECATED. Thin wrapper around engine.metrics.distribution_sanity_check.
Use engine.metrics.distribution_sanity_check directly for all new code.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.metrics import distribution_sanity_check


def run_sanity_check(historical_preds):
    """
    DEPRECATED: Use engine.metrics.distribution_sanity_check() directly.
    This wrapper exists only for backward compatibility.
    """
    print("[DEPRECATED] models/sanity_check.py - use engine.metrics.distribution_sanity_check()")
    result = distribution_sanity_check(historical_preds)

    print("=== Distribution Sanity Check ===")
    for key in ['check1', 'check2', 'check3']:
        check = result[key]
        status = "PASS" if check['pass'] else "FAIL"
        print(f"  {key}: {status} - {check.get('description', '')}")

    if not result['overall']:
        raise Exception("Sanity check FAILED: Distribution collapsed. Launch blocked.")

    print("  OVERALL: PASS - Distributions look healthy.")
    return True
