from typing import Dict, Any
import os

class PromotionCommittee:
    """
    The automated checklist that determines if an Alpha can be promoted to the next Evidence Level.
    """
    @staticmethod
    def generate_report(experiment_id: str, specs: Dict[str, Any], results: Dict[str, Any], filepath: str):
        """
        Generates the standard Automatic Research Report and runs the Promotion Checklist.
        """
        
        # Committee Checklist Logic
        checklist = {
            "Reproducible": specs.get("is_reproducible", True),
            "Historical Verified": results.get("evidence_level") == "L2_HISTORICAL",
            "Baseline Beaten": results.get("beats_baseline", True),
            "Multiple Testing Passed": results.get("passes_fdr", True),
            "Robust Across Seasons": results.get("robust_seasons", True)
        }
        
        all_passed = all(checklist.values())
        decision = "PROMOTED to L3" if all_passed else "REJECTED (See Checklist)"
        
        content = f"""# Automatic Research Report
## Executive Summary
Experiment ID: {experiment_id}
Promotion Decision: **{decision}**

## Promotion Committee Checklist
"""
        for req, passed in checklist.items():
            mark = "✅" if passed else "❌"
            content += f"- {mark} {req}\n"
            
        content += f"""
## Failure Analysis
If rejected, this hypothesis will be sent to the Negative Result Registry.
"""
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return all_passed
