# HandicapLab Operational Incident Management Policy
**Production Reliability, Severity Classifications & Response Protocols**

---

## 1. Incident Severity Matrix

| Severity Level | Operational Impact | Example Scenarios | Target Recovery SLA | Escalation |
| :---: | :--- | :--- | :---: | :--- |
| **P0 (Critical)** | Core prediction publishing pipeline failure; zero predictions generated pre-kickoff. | Pipeline crash, provider API blackout, RLS database lock. | **Immediate (&lt; 1 Hour)** | PagerDuty / On-Call Lead |
| **P1 (High)** | Settlement engine failure; match outcomes not settled post-kickoff. | Result settlement worker fail, API settlement mismatch. | **&lt; 4 Hours** | Lead Engineer |
| **P2 (Medium)** | Public REST API or Merkle Manifest generation degraded/down. | `/api/public/metrics` latency &gt; 2s, manifest generation delay. | **&lt; 12 Hours** | Platform Engineer |
| **P3 (Low)** | Non-critical visual UI / dashboard display anomaly. | CSS styling bug, minor UI alignment issue on `/validation`. | **Scheduled (Next Release)** | Product Backlog |

---

## 2. Incident Handling & Audit Trail Procedure

1. **Detection & Triage**: Automated health check alerts trigger P0/P1 notifications.
2. **Containment**: Failover to secondary data providers (e.g., Football-Data fallback).
3. **Root Cause Analysis (RCA)**: Document incident root cause, feature attribution, and fix hash.
4. **Public Transparency**: Any P0 or P1 incident affecting prediction ledger settlement is logged publicly in the **Hall of Mistakes** (`/research/hall-of-mistakes`).

---

## 3. Maintenance & Release Isolation (v2.8 LTS Policy)

Production branch (`main`) is strictly designated as **v2.8 LTS**. All commits to `main` are restricted to P0–P3 bug fixes, security patches, and reliability monitoring. No prediction algorithm modifications are permitted during the evidence accumulation phase.
