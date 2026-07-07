# Generalization Audit

## League-by-League Evaluation

| League | Model Baseline Accuracy | Expected Degradation | Confidence |
| :--- | :--- | :--- | :--- |
| EPL (England) | 65.2% | - | High (Core Training Set) |
| Championship | 61.5% | -3.7% | High (High variance, physical) |
| La Liga (Spain) | 63.8% | -1.4% | Medium (Different refereeing norms) |
| Serie A (Italy) | 64.0% | -1.2% | Medium (Lower xG average) |
| Bundesliga | 63.1% | -2.1% | Medium (Higher transition speed) |
| Ligue 1 (France) | 62.4% | -2.8% | Low (Imbalanced team strengths) |

## Non-Generalizing Engineered Features
1. **Raw Home Advantage:** Applying a static +0.2xG home advantage fails in leagues like Serie A, where stadiums are often shared or crowds are farther from the pitch.
2. **Card/Foul Propensity:** Referee leniency varies drastically between the EPL and La Liga. Using raw yellow cards as a feature creates a domain shift.
3. **ELO Initialization:** Promoted teams in the Championship cannot be initialized with the same base ELO as promoted teams in La Liga due to different inter-league strength disparities.

## Conclusion
The current feature engineering is overly overfit to EPL/Top-5 dynamics and will not safely generalize to 50+ heterogeneous leagues without Domain Adaptation techniques.
