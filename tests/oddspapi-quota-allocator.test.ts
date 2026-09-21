import { describe, it, expect, beforeEach } from 'vitest';
import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';

describe('OddsPapiQuotaAllocator Quota Safety & Reserve Floor', () => {
  beforeEach(() => {
    // Reset to clean test state
    OddsPapiQuotaAllocator.resetState(250, 0);
  });

  it('initializes with correct tier allocations and buffer', () => {
    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalMonthlyBudget).toBe(250);
    expect(state.totalRemaining).toBe(250);
    expect(state.totalUsed).toBe(0);
    expect(state.reserveFloor).toBe(50);
    expect(state.usableRemaining).toBe(200);

    // Tier A: 60% = 150
    expect(state.tierBudgets.A.allocatedBudget).toBe(150);
    expect(state.tierBudgets.A.remaining).toBe(150);

    // Tier B: 25% = 62
    expect(state.tierBudgets.B.allocatedBudget).toBe(62);
    expect(state.tierBudgets.B.remaining).toBe(62);

    // Tier C: 10% = 25
    expect(state.tierBudgets.C.allocatedBudget).toBe(25);
    expect(state.tierBudgets.C.remaining).toBe(25);

    // Buffer: 5% = 12
    expect(state.bufferBudget.allocatedBudget).toBe(12);
    expect(state.bufferBudget.remaining).toBe(12);
  });

  it('correctly calculates usable quota when remaining is 98 (remaining - 50 = 48)', () => {
    // 250 limit, 152 used = 98 remaining
    OddsPapiQuotaAllocator.resetState(250, 152);
    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalRemaining).toBe(98);
    expect(state.reserveFloor).toBe(50);
    expect(state.usableRemaining).toBe(48);
    expect(state.status).toBe('NORMAL');
  });

  it('allows normal acquisition within budget', () => {
    OddsPapiQuotaAllocator.resetState(250, 152); // 98 remaining, 48 usable
    const decision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'HIGH',
      cost: 1,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('ACQUIRE_PERMITTED');
    expect(decision.reservationToken).toBeDefined();
    expect(decision.usableRemaining).toBe(48);
  });

  it('rejects requests when remaining <= 50 (EMERGENCY_RESERVE_ACTIVE)', () => {
    // 250 limit, 200 used = 50 remaining
    OddsPapiQuotaAllocator.resetState(250, 200);
    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalRemaining).toBe(50);
    expect(state.usableRemaining).toBe(0);
    expect(state.status).toBe('EMERGENCY_RESERVE_ACTIVE');

    const decision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'HIGH',
      cost: 1,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('EMERGENCY_RESERVE_ACTIVE');
  });

  it('rejects requests that would breach the 50 reserve floor', () => {
    // 250 limit, 199 used = 51 remaining. Cost of 2 would result in 49 (< 50)
    OddsPapiQuotaAllocator.resetState(250, 199);
    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalRemaining).toBe(51);
    expect(state.usableRemaining).toBe(1);

    const decision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'HIGH',
      cost: 2,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('would breach reserve floor');
  });

  it('enforces CRITICAL_QUOTA when remaining <= 20', () => {
    OddsPapiQuotaAllocator.resetState(250, 235); // 15 remaining
    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalRemaining).toBe(15);
    expect(state.status).toBe('CRITICAL_QUOTA');

    const highDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'HIGH',
      cost: 1,
    });
    expect(highDecision.allowed).toBe(false);
    expect(highDecision.reason).toContain('CRITICAL_QUOTA');

    const critDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'CRITICAL',
      cost: 1,
    });
    expect(critDecision.allowed).toBe(true);
  });

  it('enforces HARD_STOP when remaining <= 5', () => {
    OddsPapiQuotaAllocator.resetState(250, 246); // 4 remaining
    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalRemaining).toBe(4);
    expect(state.status).toBe('HARD_STOP');

    const critDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'CRITICAL',
      cost: 1,
    });
    expect(critDecision.allowed).toBe(false);
    expect(critDecision.reason).toContain('HARD_STOP');
  });

  it('enforces single-league 25% maximum ceiling', () => {
    // 25% of 250 is 62 requests
    const state = OddsPapiQuotaAllocator.loadState();
    state.leagueUsage['ENG-PL'] = 62;
    OddsPapiQuotaAllocator.saveState(state);

    const normalDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'NORMAL',
      cost: 1,
    });

    expect(normalDecision.allowed).toBe(false);
    expect(normalDecision.reason).toContain('LEAGUE_CEILING_EXCEEDED');

    // CRITICAL priority can bypass league ceiling if total budget exists
    const criticalDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'CRITICAL',
      cost: 1,
    });
    expect(criticalDecision.allowed).toBe(true);
  });

  it('records detailed call instrumentation upon usage', () => {
    OddsPapiQuotaAllocator.resetState(250, 152); // 98 remaining, 48 usable

    const record = OddsPapiQuotaAllocator.recordUsage({
      leagueId: 'ENG-PL',
      tier: 'A',
      cost: 1,
      fixtureId: '1203456',
      market: 'AH',
      endpoint: 'odds-by-tournaments',
      reservationId: 'res_test_123',
      billable: true,
    });

    expect(record.cost).toBe(1);
    expect(record.countBefore).toBe(152);
    expect(record.countAfter).toBe(153);
    expect(record.remainingBefore).toBe(98);
    expect(record.remainingAfter).toBe(97);
    expect(record.usableRemainingBefore).toBe(48);
    expect(record.usableRemainingAfter).toBe(47);
    expect(record.fixtureId).toBe('1203456');
    expect(record.market).toBe('AH');
    expect(record.billable).toBe(true);

    const afterState = OddsPapiQuotaAllocator.loadState();
    expect(afterState.totalRemaining).toBe(97);
    expect(afterState.usableRemaining).toBe(47);
  });
});
