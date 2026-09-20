import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { CanonicalFixture } from '@/lib/services/canonicalFixtureRegistry';

describe('P0 Acceptance Test: Real End-to-End Publishing Propagation', () => {
  beforeEach(() => {
    // Reset store before test
    ProductionPublishingEngine.saveStore({});
  });

  it('executes full automated lifecycle: discovery -> publish -> update -> removal', async () => {
    const nowMs = Date.now();
    const kickoffUtc = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(); // 24h away

    const initialFixture: CanonicalFixture = {
      fixtureId: 'epl_arsenal_chelsea_test',
      providerFixtureId: '1501234',
      competitionId: 39,
      competitionName: 'Premier League',
      season: '2026',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoffUtc,
      status: 'SCHEDULED',
      source: 'api-football',
      firstSeenAt: new Date(nowMs - 1000).toISOString(),
      lastSyncedAt: new Date(nowMs - 500).toISOString(),
      markets: {
        asianHandicap: {
          available: true,
          line: -0.25,
          homeOdds: 1.95,
          awayOdds: 1.95,
        },
        overUnder: { available: false },
        btts: { available: false },
      },
    };

    // ─── STEP 1: INITIAL AUTOMATIC RECONCILIATION & PUBLISH ─────────────────
    const report1 = await ProductionPublishingEngine.reconcileAndPublish({
      triggeredBy: 'SCHEDULER_CRON',
      customFixtures: [initialFixture],
      customOdds: [],
    });

    expect(report1.publishedCount).toBe(1);

    const publishedSignals1 = ProductionPublishingEngine.getPublishedSignals();
    expect(publishedSignals1.length).toBe(1);

    const signal1 = publishedSignals1[0];
    expect(signal1.match).toBe('Arsenal vs Chelsea');
    expect(signal1.market).toBe('AH');
    expect(signal1.line).toBe(-0.25);
    expect(signal1.currentOdds).toBe(1.95);
    expect(signal1.publishState).toBe('PUBLISHED');
    expect(signal1.validityStatus).toBe('VALID');
    expect(signal1.strengthLevel).toBeDefined();
    expect(signal1.signalColor).toBeDefined();

    const initialHash = signal1.payloadHash;
    expect(initialHash.length).toBe(64);

    // ─── STEP 2: ODDS MOVEMENT TRIGGER & IN-PLACE ATOMIC UPDATE ─────────────
    // Simulating line price shortening from 1.95 to 1.84
    const updatedFixture: CanonicalFixture = {
      ...initialFixture,
      lastSyncedAt: new Date().toISOString(),
      markets: {
        asianHandicap: {
          available: true,
          line: -0.25,
          homeOdds: 1.84, // Shortened odds
          awayOdds: 2.08,
        },
        overUnder: { available: false },
        btts: { available: false },
      },
    };

    const report2 = await ProductionPublishingEngine.reconcileAndPublish({
      triggeredBy: 'PROVIDER_UPDATE',
      customFixtures: [updatedFixture],
      customOdds: [],
    });

    expect(report2.updatedCount).toBe(1);

    // Assert strictly that no duplicate signal was created (still exactly 1)
    const publishedSignals2 = ProductionPublishingEngine.getPublishedSignals();
    expect(publishedSignals2.length).toBe(1);

    const signal2 = publishedSignals2[0];
    expect(signal2.signalId).toBe(signal1.signalId); // Exact same ID
    expect(signal2.currentOdds).toBe(1.84); // Updated price
    expect(signal2.payloadHash).not.toBe(initialHash); // New payload hash

    // Assert audit trail captured the update
    const auditLogs = ProductionPublishingEngine.getAuditLog(10);
    const updateEvent = auditLogs.find((e) => e.signalId === signal1.signalId && e.triggeredBy === 'PROVIDER_UPDATE');
    expect(updateEvent).toBeDefined();
    expect(updateEvent?.transitionReason).toContain('ODDS_MOVEMENT');

    // ─── STEP 3: MATCH EXPIRATION / KICKOFF PASSING AUTOMATIC RETIREMENT ────
    // Manually set fixture kickoff to the past
    signal2.kickoffUtc = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 mins ago
    const store = ProductionPublishingEngine.loadStore();
    store[signal2.signalId] = signal2;
    ProductionPublishingEngine.saveStore(store);

    const report3 = await ProductionPublishingEngine.reconcileAndPublish({
      triggeredBy: 'SCHEDULER_CRON',
      customFixtures: [],
      customOdds: [],
    });

    expect(report3.removedCount).toBe(1);

    // Signal must automatically disappear from public published signals
    const publicSignalsAfterKickoff = ProductionPublishingEngine.getPublishedSignals();
    expect(publicSignalsAfterKickoff.length).toBe(0);

    // Old record remains safely archived in the store as REMOVED (never silently deleted)
    const rawStore = ProductionPublishingEngine.loadStore();
    expect(rawStore[signal1.signalId].publishState).toBe('REMOVED');
  });
});
