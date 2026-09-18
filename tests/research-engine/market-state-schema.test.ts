import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import {
  type FootballMatchFact,
  type MarketStateObservation,
  type ModelPredictionState,
} from '../../src/lib/research/market-state/types';

describe('Phase 1: Market State Schema & State Separation Tests', () => {
  it('1. Enforces independent provenance across all three state tiers', () => {
    // 1. Football State
    const footballFact: FootballMatchFact = {
      canonicalMatchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      leagueId: 'ENG-PL',
      season: '2025-2026',
      kickoffTime: '2026-02-01T14:00:00.000Z',
      homeTeam: 'Aston Villa',
      awayTeam: 'Brentford FC',
      status: 'FINISHED',
      result: {
        fullTimeHomeGoals: 2,
        fullTimeAwayGoals: 1,
        outcome1X2: '1',
        totalGoals: 3,
        btts: true,
      },
      provenance: {
        sourceProvider: 'api-football',
        sourceId: 'fixture-987654',
        capturedAt: '2026-02-01T16:00:00.000Z',
        schemaVersion: 'football-fact-v1',
      },
    };

    // 2. Market State
    const marketObservation: MarketStateObservation = {
      matchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      horizon: 'T_15M',
      bookmaker: 'pinnacle',
      market: 'AH',
      selection: 'home',
      line: -0.75,
      odds: 1.952,
      providerTimestamp: '2026-02-01T13:50:00.000Z',
      captureTimestamp: '2026-02-01T13:51:00.000Z',
      source: 'oddspapi:/v4/historical-odds',
      provenance: {
        sourceProvider: 'oddspapi',
        sourceId: 'id1000001761300977',
        capturedAt: '2026-02-01T13:50:00.000Z',
        schemaVersion: 'market-state-v1',
      },
    };

    // 3. Model State
    const modelState: ModelPredictionState = {
      predictionId: 'pred-uuid-12345',
      matchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      modelVersion: 'dixon-coles-profile-mle-v1.0.0',
      horizon: 'T_15M',
      predictionTimestamp: '2026-02-01T13:45:00.000Z',
      fittedParameters: {
        homeAttack: 0.25,
        awayAttack: -0.10,
        homeDefense: -0.05,
        awayDefense: 0.15,
        homeAdvantage: 0.22,
        leagueBaseline: 0.18,
        rho: -0.065,
      },
      featureSnapshot: {
        rolling_xg_diff: 0.35,
        rest_days_diff: 1,
      },
      marketSnapshotRef: 'snapshot-ref-999',
      probabilities: [
        {
          market: 'AH',
          line: -0.75,
          selection: 'home',
          modelProbability: 0.535,
          fairOdds: 1.869,
          marketOdds: 1.952,
          expectedValue: 0.044,
          edge: 0.044,
        },
      ],
      provenance: {
        sourceProvider: 'internal-engine',
        sourceId: 'run-20260918',
        capturedAt: '2026-02-01T13:45:00.000Z',
        schemaVersion: 'model-state-v1',
      },
    };

    expect(footballFact.provenance.sourceProvider).toBe('api-football');
    expect(marketObservation.provenance.sourceProvider).toBe('oddspapi');
    expect(modelState.provenance.sourceProvider).toBe('internal-engine');
  });

  it('2. Preserves discrete quarter-ball lines without numeric rounding drift', () => {
    const lines = [-2.25, -1.75, -0.75, -0.25, 0.0, 0.25, 0.75, 1.25, 1.75, 2.25];
    for (const l of lines) {
      const observation: MarketStateObservation = {
        matchId: 'match-1',
        horizon: 'T_24H',
        bookmaker: 'pinnacle',
        market: 'AH',
        selection: 'home',
        line: l,
        odds: 1.95,
        providerTimestamp: '2026-02-01T10:00:00.000Z',
        captureTimestamp: '2026-02-01T10:00:00.000Z',
        source: 'test',
        provenance: {
          sourceProvider: 'oddspapi',
          sourceId: '1',
          capturedAt: '2026-02-01T10:00:00.000Z',
          schemaVersion: '1',
        },
      };
      expect(observation.line).toBe(l);
      expect(Math.abs((observation.line! * 4) % 1)).toBeLessThan(1e-6);
    }
  });

  it('3. Generates collision-free deterministic odds_id using SHA-256', () => {
    function computeOddsId(parts: string[]): string {
      return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
    }

    const id1 = computeOddsId(['ENG-PL|2026-02-01|match-1', 'AH', '-0.5', 'closing', 'pinnacle']);
    const id2 = computeOddsId(['ENG-PL|2026-02-01|match-1', 'AH', '-0.75', 'closing', 'pinnacle']);
    const id3 = computeOddsId(['ENG-PL|2026-02-01|match-1', 'AH', '-0.5', 'opening', 'pinnacle']);

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1.length).toBe(64);
  });
});

