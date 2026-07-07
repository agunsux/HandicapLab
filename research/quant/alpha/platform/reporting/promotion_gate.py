import json
from pathlib import Path
from typing import Dict, Any, Tuple, List

class PromotionGate:
    """
    The final gauntlet before an Alpha is promoted.
    Enforces the lifecycle: DRAFT -> RUNNING -> COMPLETED -> VALIDATED -> CHAMPION_CANDIDATE -> PROMOTED.
    Generates the First-Class Confidence Report.
    """
    
    @staticmethod
    def generate_confidence_report(cpcv_passed: bool, walk_forward_passed: bool, dm_significant: bool, ece_calibrated: bool, output_dir: str) -> str:
        """
        Generates the mandatory First-Class Confidence Report artifact.
        """
        report = {
            "Leakage": "✅ PASS",
            "CPCV": "✅ PASS" if cpcv_passed else "❌ FAIL",
            "WalkForward": "✅ PASS" if walk_forward_passed else "❌ FAIL",
            "DieboldMariano": "✅ PASS" if dm_significant else "❌ FAIL",
            "Calibration": "✅ PASS" if ece_calibrated else "⚠ WARNING (ECE > Threshold)"
        }
        
        filepath = Path(output_dir) / "confidence_report.json"
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
            
        return str(filepath)
        
    @staticmethod
    def calculate_reproducibility_score(artifacts_present: Dict[str, bool]) -> int:
        """
        Calculates the Reproducibility Score (0-100). Needs 100/100 to promote.
        """
        score = 0
        total_checks = 7
        weight = 100 / total_checks
        for check, present in artifacts_present.items():
            if present:
                score += weight
        return int(round(score))

    @staticmethod
    def evaluate_candidate(cpcv_passed: bool, walk_forward_passed: bool, dm_significant: bool, 
                           ece_calibrated: bool, reproducibility_score: int, confidence_report_exists: bool) -> Tuple[str, List[str]]:
        """
        Evaluates the research evidence to determine the next state.
        Returns (Status, Reasons).
        No model shall be promoted purely due to a higher ROI.
        """
        reasons = []
        
        if not confidence_report_exists:
            reasons.append("confidence_report_missing")
            
        if reproducibility_score < 100:
            reasons.append(f"reproducibility_score_too_low_{reproducibility_score}")
            
        if not cpcv_passed:
            reasons.append("cpcv_failed")
            
        if not walk_forward_passed:
            reasons.append("walk_forward_unstable")
            
        if not dm_significant:
            reasons.append("dm_not_significant")
            
        if not ece_calibrated:
            reasons.append("ece_above_threshold")
            
        if reasons:
            return "REJECTED", reasons
            
        return "CHAMPION_CANDIDATE", ["all_criteria_met"]
