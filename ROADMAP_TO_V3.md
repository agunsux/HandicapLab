# HandicapLab — Roadmap to v3.0 & Operation Year One
**Evidence-Driven Release Framework & Operational Governance**

> **"Major version releases are no longer determined by feature counts, but by the empirical depth of verifiable evidence collected from live operations."**

---

## 1. Operation Year One — 4-Quarter Evidence Milestones

Rather than adding new machine learning models or prediction features, engineering focus is frozen to accumulate live evidence across four quarters:

### Quarter 1 — Foundation & Operational Stability
- **Target**: 1,000 settled predictions in live `prediction_ledger`.
- **Invariants**:
  - 100% automated settlement pipeline execution.
  - 100% daily Merkle Root manifest generation without failure.
  - Automated weekly validation performance reports.
  - **Feature Freeze**: Zero new model architectures or feature engineering introduced.

### Quarter 2 — Independent Audit & Community API Adoption
- **Target**: Public REST API community adoption & independent quantitative verification.
- **Invariants**:
  - Publication of **Whitepaper #1**: *"Calibration Stability & Expected Calibration Error in Live Football Betting Markets"*.
  - Independent reproducibility audit of `/api/public/predictions` and downloadable open datasets.
  - Empirical verification of Expected Calibration Error ($\text{ECE} < 0.02$).

### Quarter 3 — 5,000 Settled Predictions & Institutional Branding Audit
- **Target**: 5,000 settled predictions in live `prediction_ledger`.
- **Invariants**:
  - Transition evaluation for *"Research Institute"* public positioning subject to `CLAIMS_POLICY.md`.
  - Comprehensive 3rd-party external audit of database RLS immutability and LeakageGuard proxy rules.

### Quarter 4 — 10,000 Settled Predictions & Institutional Benchmark
- **Target**: 10,000 settled predictions in live `prediction_ledger`.
- **Invariants**:
  - Longitudinal multi-season performance analysis.
  - Definitive Closing Line Value (CLV) benchmark vs Pinnacle closing lines.
  - Publication of Annual Research Report & open-source Python/R backtesting suite.

---

## 2. Operational Reliability & Governance KPIs

Our primary company KPIs shift from simple ROI tallies to system reliability, data quality, and evidence integrity:

| Governance Metric | Target Operational Benchmark | Verification Mechanism |
| :--- | :---: | :--- |
| **Daily Prediction Pipeline Success** | **100.0%** | Automated cron health telemetry |
| **Settlement Pipeline Success** | **100.0%** | Settlement engine execution log |
| **Merkle Manifest Generation** | **100.0%** | `GET /api/public/manifest` daily check |
| **Missing Settlement Rate** | **0 (Zero)** | Database null-settlement scanner |
| **Public API Uptime** | **> 99.9%** | Edge runtime status monitoring |
| **Calibration Drift** | **ECE < 0.02** | Weekly Platt scaling audit |
| **Data Completeness Score** | **> 99.9%** | Historical odds & stats ingestion check |
| **Evidence Accumulation** | **Monotonically Increasing** | Live `prediction_ledger` sample count $N$ |

---

## 3. Strict Gate Requirements for v3.0 Release

The release tag **`v3.0.0`** will ONLY be tagged when all of the following empirical gate criteria are satisfied:

- [ ] **5,000 Settled Predictions**: Minimum $N = 5,000$ settled live pre-kickoff predictions recorded in `prediction_ledger`.
- [ ] **Stable Probability Calibration**: Expected Calibration Error ($\text{ECE} < 0.02$) maintained continuously across 10 probability bins.
- [ ] **Independent Audit Completed**: External quantitative audit verifying zero look-ahead leakage and 100% timestamp authenticity ($\text{Published} < \text{Kickoff} < \text{Settled}$).
- [ ] **Zero Critical Security Incidents**: Zero unauthorized data mutations or RLS policy bypasses.
- [ ] **Public Reproducibility Verified**: 100% of published metrics independently reproducible via open CSV downloads and public REST APIs.
- [ ] **Strict Claims Compliance**: 100% compliance with `CLAIMS_POLICY.md` standards.
- [ ] **Zero Unresolved Scientific Blockers**: All root cause analyses in the *Hall of Mistakes* resolved out-of-sample.

---

*HandicapLab Research Governance Team*  
*Document Version: 1.0.0 (July 2026)*
