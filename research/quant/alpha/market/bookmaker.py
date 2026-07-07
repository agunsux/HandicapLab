import json
from typing import Dict, Any

class BookmakerProfiler:
    """
    Evaluates bookmakers for specific biases, margins, and accuracy.
    """
    
    def __init__(self):
        self.profiles = {}
        
    def add_bookmaker_data(self, name: str, data: Dict[str, Any]):
        """
        Process aggregate historical data to form a profile.
        """
        self.profiles[name] = data
        
    def generate_json_profile(self) -> str:
        """
        Generates the BOOKMAKER_PROFILE.json content.
        """
        mock_profile = {
            "Pinnacle": {
                "average_margin": 0.025,
                "closing_accuracy_brier": 0.18,
                "bias_favorite": -0.01,
                "bias_underdog": +0.02,
                "update_speed_rank": 1
            },
            "Bet365": {
                "average_margin": 0.045,
                "closing_accuracy_brier": 0.20,
                "bias_favorite": -0.03,
                "bias_underdog": +0.05,
                "update_speed_rank": 2
            }
        }
        return json.dumps(mock_profile, indent=4)
