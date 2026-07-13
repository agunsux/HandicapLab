# Shadow Mode Operations — Operation HERMES Phase II

**Purpose:** Validate the Operational Intelligence Layer (EPIC 22–24.5) with real data before activating the Commercial Layer  
**Duration:** 4–8 weeks continuous operation  
**Gate:** This is the final validation gate before commercial launch

---

## What is Shadow Mode?

Shadow Mode means the full Operational Intelligence Layer runs in production alongside the existing Research Layer, but **no commercial decisions** are made based on its output. The system:

- ✅ Fetches live data from providers through the abstraction layer (EPIC 22)
- ✅ Processes all data through the automation pipeline (EPIC 23)
- ✅ Generates all observability metrics and dashboards (EPIC 24)
- ✅ Operates under full SRE reliability framework (EPIC 24.5)
- ❌ Does NOT expose any output to end users
- ❌ Does NOT make any commercial betting decisions
- ❌ Does NOT trigger any financial transactions

**Purpose:** Prove the Operational Intelligence Layer works correctly under real conditions before trusting it with commercial operations.

---

## Phases

### Phase 0: Pre-Requisite Check (Week 0)

Before entering Shadow Mode, verify:

- [ ] EPIC 22: Provider abstraction layer deployed, at least 2 providers active
- [ ] EPIC 22: Canonical data flowing through pipeline
- [ ] EPIC 22: Data quality scoring active
- [ ] EPIC 23: Scheduler running all required jobs
- [ ] EPIC 23: Queue processing jobs without errors
- [ ] EPIC 23: Alert engine configured and tested
- [ ] EPIC 24: All 16 dashboards loading with data
- [ ] EPIC 24: Structured logging operational
- [ ] EPIC 24: Metrics registry populated
- [ ] EPIC 24.5: Configuration management active
- [ ] EPIC 24.5: Backups running
- [ ] EPIC 24.5: Runbooks documented
- [ ] All unit tests pass (`npx vitest run`)
- [ ] Zero circular dependencies (`npx madge --circular`)
- [ ] Zero TypeScript errors (`npx tsc --noEmit`)

### Phase 1: Active Monitoring (Weeks 1–2)

**Goal:** Verify all components function correctly under live conditions.

**Activities:**
- Daily review of all 16 dashboards
- Manual verification of data lineage for 10 random fixtures
- Verify provider failover by temporarily disabling primary provider
- Trigger test alerts and verify notification delivery
- Review audit trail for completeness
- Verify scheduled jobs fire on time
- Test queue processing under normal load

**Success Criteria:**
- [ ] All dashboards show data with < 30s latency
- [ ] Data lineage verified for 10/10 fixtures
- [ ] Provider failover completes in < 5s
- [ ] 100% of scheduled jobs fire on time
- [ ] All alert channels deliver test notifications
- [ ] Audit trail captures 100% of operations
- [ ] Zero data quality scores below threshold (70)

### Phase 2: Stress Testing (Weeks 3–4)

**Goal:** Verify the platform handles edge cases and stress conditions.

**Activities:**
- Simulate provider outage (disable all providers for 15 min)
- Simulate database failure (kill connection, verify reconnect)
- Trigger queue backlog (enqueue 10,000 jobs)
- Simulate worker crash (kill workers, verify pool recovery)
- Test rollback procedure (deploy dummy version, rollback)
- Restore from backup (verify data integrity)
- Test DR failover procedure

**Success Criteria:**
- [ ] Provider outage: automatic failover within 5s
- [ ] Database failure: auto-reconnect within 30s
- [ ] Queue backlog: processed within 10 min
- [ ] Worker crash: pool recovers within 30s
- [ ] Rollback: complete within 5 min, data intact
- [ ] Backup restore: data integrity verified
- [ ] DR failover: RTO < 5 min, RPO < 1 min
- [ ] All incidents documented with postmortems

### Phase 3: Stability Run (Weeks 5–8)

**Goal:** Prove the platform can operate continuously without manual intervention.

**Activities:**
- Minimal manual intervention (only for critical issues)
- Review daily operational reports
- Track SLI/SLO compliance
- Monitor error budget consumption
- Review weekly operational reports
- Track MTTR and MTBF trends
- Monitor cost against budget

**Success Criteria:**
- [ ] Zero manual interventions needed for routine operations
- [ ] 99.9%+ system uptime over entire period
- [ ] SLI/SLO compliance: all targets met
- [ ] Error budget: > 80% remaining at all times
- [ ] MTTR < 15 min for all incidents
- [ ] MTBF > 7 days
- [ ] Cost within budget (±10%)
- [ ] Daily reports generated automatically
- [ ] Weekly reports show stable trends
- [ ] All 20 runbooks reviewed and verified

---

## Monitoring During Shadow Mode

### Daily Checklist (First 2 Weeks)
```
Time: 09:00 UTC
☐ Review System Health dashboard
☐ Review Provider dashboard
☐ Review Queue dashboard
☐ Check for any active alerts
☐ Verify last 24h of audit trail
☐ Check log for errors (WARN+ level)
☐ Confirm all scheduled jobs ran
☐ Review data quality scores
☐ Check provider quota usage
☐ Document any anomalies

Time: 21:00 UTC
☐ Quick review of day's operations
☐ Verify no critical alerts overnight
☐ Check daily report was generated
```

### Daily Checklist (Weeks 3–8)
```
Time: 09:00 UTC
☐ Review System Health dashboard
☐ Check active alerts (if any)
☐ Review daily report from previous day
☐ Confirm no manual interventions needed
☐ Review any incidents from previous 24h
```

### Weekly Review
```
Day: Monday
☐ Review weekly operational report
☐ Review SLI/SLO compliance
☐ Check error budget status
☐ Review capacity forecast
☐ Review cost tracking
☐ Update runbooks if needed
☐ Plan any necessary adjustments
```

---

## Incident Management During Shadow Mode

### Severity Definitions
| Severity | Response Time | Resolution Time | Examples |
|----------|--------------|-----------------|----------|
| EMERGENCY | < 5 min | < 30 min | Database down, all providers down, data loss |
| CRITICAL | < 15 min | < 2 hours | Provider failover failed, queue stalled, worker crash |
| WARNING | < 1 hour | < 24 hours | Latency spike, single provider slow, alert misconfiguration |
| INFO | < 24 hours | < 1 week | Dashboard display issue, non-critical log error |

### Incident Flow
```
1. Alert fires (automatic)
2. Operator acknowledges alert (within response time)
3. Assess severity and impact
4. Follow runbook for known issue
   ├── Runbook exists → Execute steps
   └── No runbook → Create incident, investigate, document
5. Resolve incident
6. Conduct postmortem (within 48 hours for CRITICAL+)
7. Update runbook with lessons learned
```

### Escalation Path
```
First Responder → Senior Engineer → Architecture Owner → Project Lead
Time: 15 min       30 min           1 hour              2 hours
```

---

## Success Criteria (Gate Decision)

### MANDATORY (Must Pass to Exit Shadow Mode)
| Criteria | Threshold | Measurement |
|----------|-----------|-------------|
| Continuous operation | ≥ 4 weeks | Uptime monitoring |
| System uptime | ≥ 99.9% | Health check |
| Provider availability | ≥ 99.5% avg | Provider dashboard |
| Queue success rate | ≥ 99% | Queue dashboard |
| Scheduler miss rate | < 1% | Scheduler dashboard |
| Data quality score | ≥ 70 avg | Quality scorer |
| Audit trail integrity | 100% | Chain verification |
| Backup success rate | 100% | Backup logs |
| Error budget remaining | ≥ 80% at end | Error budget tracking |
| Manual interventions | 0 for routine ops | Operator log |

### STRONGLY RECOMMENDED (Should Pass)
| Criteria | Threshold | Measurement |
|----------|-----------|-------------|
| MTTR | < 15 min | Incident log |
| MTBF | > 7 days | Incident log |
| Cost deviation | < ±10% from budget | Cost monitor |
| Runbook coverage | 20/20 documented | Runbook manager |
| DR drill success | ≥ 1 successful | DR test log |

### INFORMATIONAL (Track but not gates)
| Criteria | Measurement |
|----------|-------------|
| Average active workers | Worker dashboard |
| Peak queue depth | Queue dashboard |
| Total API calls | Provider dashboard |
| Total predictions generated | Prediction dashboard |
| Average response time | Metrics registry |
| Data growth rate | Capacity planner |

---

## Governance

### Daily Standup (First 2 Weeks)
- Review previous 24h operations
- Discuss any incidents or anomalies
- Plan any adjustments needed
- Duration: 15 minutes

### Weekly Review (Throughout)
- Review weekly operational report
- Analyze trends (improving/degrading)
- Review capacity forecasts
- Adjust thresholds if needed
- Duration: 30 minutes

### Phase Gate Review
At the end of Week 4 and Week 8:
- Review all success criteria
- Make Pass/Fail recommendation
- Document findings
- If passed: Proceed to Commercial Layer
- If failed: Identify gaps, re-run phase

---

## Rollback from Shadow Mode

If Shadow Mode reveals critical issues:

1. **Day 1–7 Failure**: Address issue, restart Phase 1
2. **Week 2–4 Failure**: Fix issue, restart from Phase 2
3. **Week 5–8 Failure**: Assess if issue is regression or new; fix and decide based on severity

**Worst case**: If the Operational Intelligence Layer is fundamentally broken:
1. Revert all EPIC 22–24.5 changes via Git
2. Restore database from pre-shadow backup
3. Document root cause
4. Re-architect before re-entering Shadow Mode

---

## Documentation Required

- [ ] Daily operational reports (auto-generated, reviewed)
- [ ] Weekly operational reports (auto-generated, reviewed)
- [ ] Incident reports (for all CRITICAL+ incidents)
- [ ] Postmortems (within 48 hours of incident resolution)
- [ ] Runbook updates (based on incident learnings)
- [ ] Phase gate review document (Week 4 and Week 8)
- [ ] Final shadow mode report (end of Phase 3)

---

## Tools Required

- Dashboard access (all 16)
- Provider dashboard (latency, quota, health)
- Queue dashboard (depth, processing time, DLQ)
- Audit trail viewer
- Log search interface
- Incident management system
- Communication channels (Slack, Email, PagerDuty)
- Backup/restore access
- DR failover access