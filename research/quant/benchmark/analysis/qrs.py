class QuantResearchScore:
    """
    Calculates the composite Quant Research Score (QRS).
    Maximum score is 100.
    """
    def __init__(self):
        self.weights = {
            'calibration': 0.20,
            'generalization': 0.20,
            'profitability': 0.20,
            'significance': 0.15,
            'robustness': 0.15,
            'explainability': 0.10
        }
        
    def calculate(self, 
                  calibration_score: float, # 0-100 (e.g. inverted Brier/ECE ranking)
                  generalization_score: float, # 0-100 (e.g. LOLO pass rate)
                  profitability_score: float, # 0-100 (e.g. ROI mapping, 5% = 100)
                  significance_score: float, # 0-100 (e.g. 1 - p_value scaled)
                  robustness_score: float, # 0-100 (e.g. variance across seasons)
                  explainability_score: float # 0-100 (e.g. SHAP coverage)
                 ) -> float:
        
        qrs = (
            calibration_score * self.weights['calibration'] +
            generalization_score * self.weights['generalization'] +
            profitability_score * self.weights['profitability'] +
            significance_score * self.weights['significance'] +
            robustness_score * self.weights['robustness'] +
            explainability_score * self.weights['explainability']
        )
        
        return round(qrs, 2)
