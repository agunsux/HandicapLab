import { describe, it, expect, beforeEach } from 'vitest';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { CanonicalFixtureRegistry } from '@/lib/services/canonicalFixtureRegistry';
import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';
import { MultiLeaguePerformanceTracker, type MarketPerformanceTrackKey } from '@/lib/research/multiLeaguePerformance';
import { getLeagueByKey } from '@/lib/config/multiLeagueRegistry';

describe('Multi-League Pipeline Integration Tests', () => {
  beforeEach(() => {
    OddsPapiQuotaAllocator.resetState(250);
  });

  describe('Prediction Horizon Bucketing', () => {
    const baseNow = '2026-10-15T12:00:00.000Z';

    it('computes TODAY bucket for kickoff within 24 hours', () => {
      const kickoff = '2026-10-15T20:00:00.000Z'; // 8 hours away
      const bucket = DailyPicksEngine.computeHorizonBucket(kickoff, baseNow);
      expect(bucket).toBe('TODAY');
    });

    it('computes TOMORROW bucket for kickoff between 24 and 48 hours', () => {
      const kickoff = '2026-10-16T18:00:00.000Z'; // 30 hours away
      const bucket = DailyPicksEngine.computeHorizonBucket(kickoff, baseNow);
      expect(bucket).toBe('TOMORROW');
    });

    it('computes +2D through +7D for upcoming match horizons', () => {
      expect(DailyPicksEngine.computeHorizonBucket('2026-10-17T18:00:00.000Z', baseNow)).toBe('+2D'); // 54h
      expect(DailyPicksEngine.computeHorizonBucket('2026-10-18T18:00:00.000Z', baseNow)).toBe('+3D'); // 78h
      expect(DailyPicksEngine.computeHorizonBucket('2026-10-19T18:00:00.000Z', baseNow)).toBe('+4D'); // 102h
      expect(DailyPicksEngine.computeHorizonBucket('2026-10-20T18:00:00.000Z', baseNow)).toBe('+5D'); // 126h
      expect(DailyPicksEngine.computeHorizonBucket('2026-10-21T18:00:00.000Z', baseNow)).toBe('+6D'); // 150h
      expect(DailyPicksEngine.computeHorizonBucket('2026-10-22T18:00:00.000Z', baseNow)).toBe('+7D'); // 174h
    });
  });

  describe('Prediction Lifecycle Stages', () => {
    const baseNow = '2026-10-15T12:00:00.000Z';

    it('classifies match < 6 hours as FINAL stage', () => {
      const kickoff = '2026-10-15T16:00:00.000Z'; // 4 hours away
      const stage = DailyPicksEngine.computeLifecycleStage(kickoff, baseNow);
      expect(stage).toBe('FINAL');
    });

    it('classifies match between 6 and 72 hours as PRE-MATCH stage', () => {
      const kickoff = '2026-10-16T15:00:00.000Z'; // 27 hours away
      const stage = DailyPicksEngine.computeLifecycleStage(kickoff, baseNow);
      expect(stage).toBe('PRE-MATCH');
    });

    it('classifies match > 72 hours as EARLY stage', () => {
      const kickoff = '2026-10-19T15:00:00.000Z'; // 99 hours away
      const stage = DailyPicksEngine.computeLifecycleStage(kickoff, baseNow);
      expect(stage).toBe('EARLY');
    });
  });

  describe('Canonical Identity Generation across Multi-League Fixtures', () => {
    it('generates consistent deterministic SHA256 IDs for fixtures across leagues', () => {
      // EPL Fixture
      const eplId1 = CanonicalFixtureRegistry.generateCanonicalFixtureId(
        39,
        '2026',
        'Arsenal',
        'Chelsea',
        '2026-10-15T15:00:00Z'
      );
      const eplId2 = CanonicalFixtureRegistry.generateCanonicalFixtureId(
        39,
        '2026',
        'Arsenal',
        'Chelsea',
        '2026-10-15T15:00:00Z'
      );
      expect(eplId1).toBe(eplId2);
      expect(eplId1).toMatch(/^[a-f0-9]{16}$/);

      // La Liga Fixture
      const laligaId = CanonicalFixtureRegistry.generateCanonicalFixtureId(
        140,
        '2026',
        'Real Madrid',
        'Barcelona',
        '2026-10-16T20:00:00Z'
      );
      expect(laligaId).toMatch(/^[a-f0-9]{16}$/);
      expect(laligaId).not.toBe(eplId1);

      // Serie A Fixture
      const serieAId = CanonicalFixtureRegistry.generateCanonicalFixtureId(
        135,
        '2026',
        'Inter Milan',
        'AC Milan',
        '2026-10-17T19:45:00Z'
      );
      expect(serieAId).toMatch(/^[a-f0-9]{16}$/);
      expect(serieAId).not.toBe(laligaId);
    });
  });

  describe('Multi-League Odds De-vigging & Overround Calculations', () => {
    it('correctly de-vigs Pinnacle two-way lines into fair probabilities summing to 1.0', () => {
      const balanced = DailyPicksEngine.devigTwoWay(1.95, 1.95);
      expect(balanced.pA).toBeCloseTo(0.5, 3);
      expect(balanced.pB).toBeCloseTo(0.5, 3);
      expect(balanced.pA + balanced.pB).toBeCloseTo(1.0, 5);
      expect(balanced.overround).toBeGreaterThan(1.0); // ~1.0256 (2.56% margin)

      const asymmetric = DailyPicksEngine.devigTwoWay(1.50, 2.70);
      expect(asymmetric.pA + asymmetric.pB).toBeCloseTo(1.0, 5);
      expect(asymmetric.pA).toBeGreaterThan(asymmetric.pB);
      expect(asymmetric.pA).toBeCloseTo((1 / 1.5) / (1 / 1.5 + 1 / 2.7), 4);
    });
  });

  describe('Quota Reservation Flow across Multiple League Tiers', () => {
    it('manages concurrent tier requests with strict budget enforcement', () => {
      // 1. Tier A league request (EPL)
      const eplDecision = OddsPapiQuotaAllocator.canAcquire({
        leagueId: 'ENG-PL',
        tier: 'A',
        priority: 'HIGH',
      });
      expect(eplDecision.allowed).toBe(true);
      OddsPapiQuotaAllocator.recordUsage({ leagueId: 'ENG-PL', tier: 'A', cost: 1 });

      // 2. Tier B league request (Eredivisie)
      const ereDecision = OddsPapiQuotaAllocator.canAcquire({
        leagueId: 'NED-ERE',
        tier: 'B',
        priority: 'NORMAL',
      });
      expect(ereDecision.allowed).toBe(true);
      OddsPapiQuotaAllocator.recordUsage({ leagueId: 'NED-ERE', tier: 'B', cost: 1 });

      // 3. Tier C league request (J1 League)
      const j1Decision = OddsPapiQuotaAllocator.canAcquire({
        leagueId: 'JPN-J1',
        tier: 'C',
        priority: 'LOW',
      });
      expect(j1Decision.allowed).toBe(true);
      OddsPapiQuotaAllocator.recordUsage({ leagueId: 'JPN-J1', tier: 'C', cost: 1 });

      const state = OddsPapiQuotaAllocator.loadState();
      expect(state.totalUsed).toBe(3);
      expect(state.tierBudgets.A.used).toBe(1);
      expect(state.tierBudgets.B.used).toBe(1);
      expect(state.tierBudgets.C.used).toBe(1);
      expect(state.leagueUsage['ENG-PL']).toBe(1);
      expect(state.leagueUsage['NED-ERE']).toBe(1);
      expect(state.leagueUsage['JPN-J1']).toBe(1);
    });
  });

  describe('Multi-League Validated Performance Tracker', () => {
    const trackKey: MarketPerformanceTrackKey = {
      league: 'ENG-PL',
      market: 'AH',
      season: '2026',
      line: -0.25,
      oddsBand: '1.75-2.00',
      predictionHorizon: 'PRE-MATCH',
      modelVersion: 'q4_canonical_v1',
    };

    it('flags sample size < 100 as LIMITED SAMPLE and PROVISIONAL', () => {
      const sample = [
        { modelProb: 0.55, marketOdds: 1.95, closingOdds: 1.90, won: true },
        { modelProb: 0.52, marketOdds: 1.92, closingOdds: 1.95, won: false },
        { modelProb: 0.58, marketOdds: 1.91, closingOdds: 1.85, won: true },
      ];

      const record = MultiLeaguePerformanceTracker.evaluateCohort(trackKey, sample);
      expect(record.metrics.sampleSize).toBe(3);
      expect(record.metrics.sampleStatus).toBe('LIMITED SAMPLE');
      expect(record.metrics.reliabilityBadge).toBe('EXPERIMENTAL');
      expect(record.metrics.brierScore).toBeGreaterThan(0);
    });

    it('awards STATISTICALLY_VIABLE and ROBUST badge when sample size >= 100', () => {
      const largeSample = [];
      for (let i = 0; i < 120; i++) {
        largeSample.push({
          modelProb: 0.55,
          marketOdds: 1.95,
          closingOdds: 1.90,
          won: i % 2 === 0, // 50% hit rate
        });
      }

      const record = MultiLeaguePerformanceTracker.evaluateCohort(trackKey, largeSample);
      expect(record.metrics.sampleSize).toBe(120);
      expect(record.metrics.sampleStatus).toBe('STATISTICALLY_VIABLE');
      expect(record.metrics.reliabilityBadge).toBe('ROBUST');
      expect(record.metrics.hitRate).toBe(0.5);
    });
  });
});
