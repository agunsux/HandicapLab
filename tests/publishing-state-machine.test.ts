import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { PublishTransitionEvent } from '@/lib/publishing/types';

describe('Publishing State Machine Specification', () => {
  beforeEach(() => {
    // Reset store before each test
    ProductionPublishingEngine.saveStore({});
  });

  it('records state transitions with full audit trail', () => {
    const event: PublishTransitionEvent = {
      transitionId: 'tr_test_1',
      signalId: 'sig_test_fixture_AH_-0.25',
      canonicalMatchId: 'test_fixture',
      market: 'AH',
      selection: 'Arsenal -0.25',
      previousState: null,
      newState: 'PUBLISHED',
      transitionReason: 'Initial production qualification',
      timestampUtc: new Date().toISOString(),
      payloadHash: 'hash_test_123',
      triggeredBy: 'SCHEDULER_CRON',
    };

    ProductionPublishingEngine.logTransition(event);

    const log = ProductionPublishingEngine.getAuditLog(10);
    expect(log.length).toBeGreaterThan(0);
    const found = log.find((e) => e.transitionId === 'tr_test_1');
    expect(found).toBeDefined();
    expect(found?.newState).toBe('PUBLISHED');
    expect(found?.triggeredBy).toBe('SCHEDULER_CRON');
  });

  it('filters out REMOVED or expired signals from public published getter', () => {
    const nowMs = Date.now();
    const futureKickoff = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
    const pastKickoff = new Date(nowMs - 60 * 1000).toISOString();

    const mockStore: any = {
      sig_live: {
        signalId: 'sig_live',
        canonicalMatchId: 'match_live',
        match: 'Arsenal vs Chelsea',
        publishState: 'PUBLISHED',
        kickoffUtc: futureKickoff,
        market: 'AH',
        selection: 'Arsenal -0.25',
        line: -0.25,
        currentOdds: 1.95,
        modelProbability: 0.55,
        marketProbability: 0.51,
        edge: 0.04,
        expectedValue: 0.07,
        confidence: 72,
        strengthLevel: 'STRONG',
        signalColor: 'green',
      },
      sig_past: {
        signalId: 'sig_past',
        canonicalMatchId: 'match_past',
        match: 'Liverpool vs Everton',
        publishState: 'PUBLISHED',
        kickoffUtc: pastKickoff, // Past kickoff
        market: 'OU',
        selection: 'Over 2.5',
      },
      sig_shadow: {
        signalId: 'sig_shadow',
        canonicalMatchId: 'match_shadow',
        match: 'Persija vs Persib',
        publishState: 'SHADOW',
        kickoffUtc: futureKickoff,
        market: 'BTTS',
        selection: 'Yes',
      },
    };

    ProductionPublishingEngine.saveStore(mockStore);

    const publicSignals = ProductionPublishingEngine.getPublishedSignals();
    // Only sig_live should be returned
    expect(publicSignals.length).toBe(1);
    expect(publicSignals[0].signalId).toBe('sig_live');
    expect(publicSignals[0].publishState).toBe('PUBLISHED');
  });
});
