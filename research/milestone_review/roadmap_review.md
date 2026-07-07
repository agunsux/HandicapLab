# Part 11: Roadmap Validation
Is Sprint 31B (CatBoost) the highest ROI next step? 
**NO.**
Given Bottleneck #1 is Categorical Handling, CatBoost *does* solve this. However, Data Debt (CSV bottlenecks) and Production Readiness (Observability UI, Inference API) are massive risks. Furthermore, **Market Line Velocity** and resolving the **Favorite Bias** (via Custom Loss Functions) offer higher immediate ROI than simply swapping the gradient booster. 

*Recommendation*: Pivot to implementing Custom Asymmetric Loss Functions to fix the Favorite Leak, or upgrade the Data Pipeline to handle multi-league ingestion, before blindly adding CatBoost.
