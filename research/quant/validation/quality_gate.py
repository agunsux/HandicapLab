def run_quality_gate(metrics_passed: bool, leakage_passed: bool, metadata_logged: bool, sig_passed: bool) -> str:
    """
    Evaluates the strict Quality Gate rules.
    If ANY validation fails, the status is INVALID (not REJECT).
    If validation passes but metrics aren't better, REJECT.
    If validation passes and metrics are better/significant, ADOPT.
    """
    
    # 1. Fail-fast criteria
    if not leakage_passed:
        print("[QUALITY GATE] FAILED: Data Leakage tests did not pass.")
        return "INVALID"
        
    if not metadata_logged:
        print("[QUALITY GATE] FAILED: Dataset metadata/hash not logged.")
        return "INVALID"
        
    # 2. Performance criteria
    if not metrics_passed:
        print("[QUALITY GATE] FAILED: Validation metrics (walk-forward) deteriorated or did not improve sufficiently.")
        return "REJECT"
        
    if not sig_passed:
        print("[QUALITY GATE] FAILED: Statistical significance test failed.")
        return "REVISIT"
        
    print("[QUALITY GATE] PASSED: Experiment is valid and improves performance.")
    return "ADOPT"
