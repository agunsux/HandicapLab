from typing import List, Dict, Any

class ExperimentPriorityQueue:
    """
    Determines 'What to Test Next' based on scoring criteria.
    """
    
    def __init__(self):
        self.queue = []
        
    def add_hypothesis(self, hypothesis_id: str, expected_info_gain: float, novelty: float, compute_cost: float, business_value: float):
        """
        Calculates Priority Score: InfoGain + Novelty + BusinessValue - ComputeCost
        """
        # Normalized weights
        score = (expected_info_gain * 0.4) + (novelty * 0.3) + (business_value * 0.4) - (compute_cost * 0.2)
        
        self.queue.append({
            "hypothesis_id": hypothesis_id,
            "score": score,
            "metrics": {
                "info_gain": expected_info_gain,
                "novelty": novelty,
                "compute_cost": compute_cost,
                "business_value": business_value
            }
        })
        
    def get_next_experiment(self) -> Dict[str, Any]:
        """
        Pops the highest priority hypothesis.
        """
        if not self.queue:
            return None
            
        self.queue.sort(key=lambda x: x["score"], reverse=True)
        return self.queue.pop(0)
