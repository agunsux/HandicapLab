import { describe, it, expect, beforeEach } from 'vitest';
import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';

describe('OddsPapiQuotaAllocator Unit Tests', () => {
  beforeEach(() => {
    // Reset state before each test with standard 250 budget
    OddsPapiQuotaAllocator.resetState(250);
  });

  it('initializes with correct tier allocations and buffer', () => {
    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalMonthlyBudget).toBe(250);
    expect(state.totalRemaining).toBe(250);
    expect(state.totalUsed).toBe(0);

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

  it('allows normal acquisition within budget', () => {
    const decision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'NORMAL',
      cost: 1,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('ACQUIRE_PERMITTED');
    expect(decision.reservationToken).toBeDefined();
  });

  it('records usage and decrements remaining quota accurately', () => {
    OddsPapiQuotaAllocator.recordUsage({
      leagueId: 'ENG-PL',
      tier: 'A',
      cost: 5,
    });

    const state = OddsPapiQuotaAllocator.loadState();
    expect(state.totalUsed).toBe(5);
    expect(state.totalRemaining).toBe(245);
    expect(state.tierBudgets.A.used).toBe(5);
    expect(state.tierBudgets.A.remaining).toBe(145);
    expect(state.leagueUsage['ENG-PL']).toBe(5);
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

  it('enforces tier exhaustion', () => {
    const state = OddsPapiQuotaAllocator.loadState();
    // Exhaust Tier C (25 calls)
    state.tierBudgets.C.used = 25;
    state.tierBudgets.C.remaining = 0;
    OddsPapiQuotaAllocator.saveState(state);

    const decision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'JPN-J1',
      tier: 'C',
      priority: 'NORMAL',
      cost: 1,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('TIER_C_BUDGET_EXHAUSTED');
  });

  it('enforces Economy Mode when remaining < 30 (rejects LOW priority)', () => {
    const state = OddsPapiQuotaAllocator.loadState();
    state.totalRemaining = 25;
    OddsPapiQuotaAllocator.saveState(state);

    const lowDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ESP-LALIGA',
      tier: 'A',
      priority: 'LOW',
      cost: 1,
    });
    expect(lowDecision.allowed).toBe(false);
    expect(lowDecision.reason).toContain('ECONOMY_MODE_ACTIVE');

    const normalDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ESP-LALIGA',
      tier: 'A',
      priority: 'NORMAL',
      cost: 1,
    });
    expect(normalDecision.allowed).toBe(true);
  });

  it('enforces Safety Reserve when remaining < 5 (only CRITICAL allowed)', () => {
    const state = OddsPapiQuotaAllocator.loadState();
    state.totalRemaining = 4;
    OddsPapiQuotaAllocator.saveState(state);

    const normalDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'NORMAL',
      cost: 1,
    });
    expect(normalDecision.allowed).toBe(false);
    expect(normalDecision.reason).toContain('SAFETY_RESERVE_ACTIVE');

    const criticalDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'CRITICAL',
      cost: 1,
    });
    expect(criticalDecision.allowed).toBe(true);
  });

  it('rejects all acquisition when total quota is fully exhausted', () => {
    const state = OddsPapiQuotaAllocator.loadState();
    state.totalRemaining = 0;
    state.status = 'EXHAUSTED';
    OddsPapiQuotaAllocator.saveState(state);

    const decision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'CRITICAL',
      cost: 1,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('QUOTA_EXHAUSTED');
  });
});

