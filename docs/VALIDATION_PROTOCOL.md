# 60–90 DAY LIVE VALIDATION PROTOCOL

**Document Version:** 1.0.0  
**Phase:** EPIC 35  

---

## 1. Protocol Objective

HandicapLab must execute autonomously in production for 60 to 90 consecutive days to gather objective, un-biased empirical evidence on model performance before any adaptive learning or automated retraining (EPIC 42) is permitted.

---

## 2. Exit Criteria for EPIC 35

EPIC 35 is deemed successful ONLY when all of the following criteria are satisfied:

1. **Autonomous Execution**: Minimum of 60 consecutive days of execution without manual intervention.
2. **Zero Modification**: 0 records modified, edited, or deleted in `prediction_snapshots` or `settlements`.
3. **Zero Duplicates**: 0 duplicate prediction snapshots or duplicate settlements generated.
4. **Stable Reliability**: Scheduler execution reliability &ge; 99.9%.
5. **Positive Predictive Value**: Empirical proof of positive Closing Line Value (CLV &gt; 0) and calibration stability under live market conditions.

Only upon meeting these criteria may EPIC 42 (Auto Retraining Platform) be initiated.
