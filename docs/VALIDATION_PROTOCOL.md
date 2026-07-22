# 60–90 DAY LIVE VALIDATION PROTOCOL & REVIEW SIGN-OFF

**Document Version:** 1.1.0  
**Phase:** EPIC 35 + EPIC 35B  
**Review Status:** **APPROVED FOR LIVE VALIDATION** (Platform Validation Complete)

---

## 1. Executive Summary & Distinction

The technical review has officially approved the **Platform Validation** of HandicapLab.

> [!IMPORTANT]
> **Platform Validation vs Model Validation**:
> - **Platform Validation (100% Complete)**: Verifies that the infrastructure, scheduler, snapshots, settlement engine, job runner, evidence archiver, and deterministic replay tool operate with zero errors, zero duplicates, and full cryptographic auditability.
> - **Model Validation (Ongoing - 60–90 Days)**: Evaluates whether the frozen model demonstrates real-world edge (positive CLV, stable calibration, positive ROI over long horizons) under live market conditions.

---

## 2. Mandatory Freeze Invariants (Strict Observer Mode)

During the 60–90 day observation period, the system operates under strict **Code & Feature Freeze**:

- ❌ **NO** new feature engineering
- ❌ **NO** new model ensembles or parameter tuning
- ❌ **NO** automated retraining (EPIC 42 is deferred until graduation)
- ❌ **NO** threshold or EV recommendation rule changes
- ❌ **NO** staking logic modifications
- 🛠️ **ONLY** operational bug fixes (infrastructure, network timeouts, API rate limits) are permitted, with zero changes to prediction calculations.

---

## 3. Graduation Target Matrix (60–90 Day Criteria)

| Metric / Requirement | Target Threshold | Operational Action |
|---|---|---|
| **Prediction Coverage** | &gt;99% of eligible fixtures | Scheduler automation monitor |
| **Snapshot Immutability** | 100% immutable | PostgreSQL engine triggers active |
| **Duplicate Predictions** | 0 duplicates | Idempotency key rejection |
| **Duplicate Settlements** | 0 duplicates | Idempotency key rejection |
| **Scheduler Uptime** | &gt;99.9% | Vercel Cron + JobRunner DLQ |
| **Deterministic Replay Audit** | 100% bit-exact success | `replayPrediction()` certification |
| **Missing Odds Quote Rate** | &lt;1.0% | Odds capture health alerts |
| **Average CLV** | Positively Retained (&gt;0.0%) | Daily/Weekly rolling metrics |
| **Calibration Stability** | ECE &lt; 3.0%, MCE &lt; 5.0% | Calibration monitor reliability curves |
| **Population Drift (PSI)** | PSI &lt; 0.10 (Stable) | Drift detector alerts |

---

## 4. Transition to EPIC 41 (Model Governance) & EPIC 42 (Auto Retraining)

At the conclusion of 90 days:
1. If **CLV remains positive**, calibration is stable, and operations are error-free: proceed to **EPIC 41 (Model Governance)** and **EPIC 42 (Auto Retraining)**.
2. If **CLV or edge degrades**: the live validation platform has succeeded in its primary duty — preventing premature automation of unproven model iterations.
