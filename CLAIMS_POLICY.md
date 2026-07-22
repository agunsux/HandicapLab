# HandicapLab Public Claims & Evidence Governance Policy

This policy governs all public messaging, website copy, documentation, and research reports produced by HandicapLab v2.

---

## 1. Core Verification Invariant

> **"Don't ask users to trust us. Let them verify us."**

We only publish claims that satisfy at least one of the following empirical conditions:

1. **Publicly Reproducible**: The claim can be independently reproduced using our downloadable open CSV datasets (`/research/datasets`).
2. **API Verifiable**: The claim can be independently queried and validated via public REST APIs (`/api/public/metrics`, `/api/public/predictions`).
3. **Immutable Ledger Provenance**: The claim is derived directly from pre-kickoff published records in the `prediction_ledger`.
4. **Published Statistical Evidence**: The claim is accompanied by explicit sample size ($N$), 95% Confidence Intervals (CI), and $p$-value hypothesis test results.
5. **Independently Audited**: The claim has been validated by an independent third-party auditor or open-source community review.

---

## 2. Restricted Claims & Marketing Copy Standards

To maintain scientific integrity, the following terms are strictly controlled:

| Restricted Term | Conditions for Permitted Usage | Default Public Alternative |
| :--- | :--- | :--- |
| **"Best" / "Most Accurate"** | **NEVER PERMITTED**. Unscientific and subjective. | *Quantitative Sports Intelligence Platform* |
| **"Scientifically Validated"** | Permitted only when $N \ge 1,000$, $\text{ECE} < 0.02$, and $p < 0.05$. | *Evidence-Driven Football Analytics* |
| **"Institutional Grade"** | Permitted only when $N \ge 10,000$ with independent 3rd-party audit. | *Transparent Quantitative Prediction Platform* |
| **"Research Institute"** | Permitted only after reaching 5,000 live settled predictions milestone. | *Open Sports Prediction Research* |

---

## 3. Internal Engineering Assessment Disclosure

All readiness scores (e.g. Production Readiness 94/100) published in internal audit documentation represent **Internal Engineering Assessments** evaluated against project technical checklists. They do not constitute third-party institutional certifications.

---

## 4. Enforcement & Governance

Any pull request or copywriting update that introduces unverified claims or subjective marketing hypes will be automatically blocked during CI/CD review.
