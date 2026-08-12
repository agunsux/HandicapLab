# Phase 0.5 Live Provider Report

## Execution

| Field | Value |
|---|---|
| Timestamp | 2026-08-12T02:19:08.784Z |
| Git Commit | `faaac01` |
| Environment | local |
| Probe Version | 0.5.0 |

## API-Football

| Metric | Result |
|---|---|
| Credential configured | YES |
| Authenticated | YES |
| HTTP status | 200 |
| Response latency | 307ms |
| Records returned | 1 |
| Schema validation | PASS |
| Schema errors | None |
| Normalization | PASS |
| Normalization details | plan=Pro, status=unknown, requests_current=2, requests_limit_day=7500 |
| Quota status | 2/7500 daily requests used |
| Provider health | **PASS** |
| Request count | 1 |
| Errors | None |

## OddsPAPI

| Metric | Result |
|---|---|
| Credential configured | YES |
| Authenticated | NO |
| HTTP status | N/A |
| Response latency | 186ms |
| Records returned | 0 |
| Schema validation | FAIL |
| Schema errors | None |
| Normalization | FAIL |
| Normalization details | N/A |
| Quota status | NOT_CHECKED |
| Provider health | **FAIL** |
| Request count | 0 |
| Errors | fetch failed |

## Cross Provider

| Check | Result |
|---|---|
| Common event found | NOT_TESTABLE |
| Details | Minimal probe endpoints (/status and /v4/sports) do not return fixture-level event data. Cross-provider matching requires fixture-level requests which exceed the minimal probe scope. |

## Safety

| Check | Count |
|---|---|
| Database writes | 0 |
| Prediction writes | 0 |
| Historical requests | 0 |
| Scheduler runs | 0 |
| Orchestrator runs | 0 |
| Unexpected requests | 0 |

## Final Verdict

| Provider | Result |
|---|---|
| API-Football | **PASS** |
| OddsPAPI | **FAIL** |

**Overall: PHASE 0.5 FAIL**
