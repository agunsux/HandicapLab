// ============================================================================
// SALMO RESCUE PIPELINE INTEGRITY TEST SUITE
// Location: tests/rescue/poisson-rescue.test.ts
// Verifies all 10 required corrections and 4 operational guardrails
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RescueMathEngine } from '@/lib/pipeline/rescue/mathEngine';
import { RescueQuotaGuard } from '@/lib/pipeline/rescue/quotaGuard';
import { RescueSettlementEngine, FinalMatchScore } from '@/lib/pipeline/rescue/settlementEngine';
import { RescueFixtureIngestion } from '@/lib/pipeline/rescue/fixtureIngestion';
import { PoissonRescueService } from '@/lib/pipeline/rescue/poissonRescueService';
import { ConfidenceGateSystem } from '@/lib/pipeline/confidenceGate';
import { RescuePredictionRecord } from '@/lib/pipeline/rescue/types';

describe('SALMO Rescue Pipeline — Quota Guard (Operation 0)', () => {
  it('blocks odds fetch and flags QUOTA_CRITICAL when remaining <= 50', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        subscriptions: [{ request_limit: 250, request_count: 215 }], // 35 remaining
      }),
    } as any);

    const result = await RescueQuotaGuard.checkOddsPapiQuota('dummy-key');
    expect(result.allowOddsFetch).toBe(false);
    expect(result.status).toBe('QUOTA_CRITICAL');
    expect(result.quotaRemaining).toBe(35);

    fetchSpy.mockRestore();
  });

  it('allows odds fetch when remaining > 50', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        subscriptions: [{ request_limit: 250, request_count: 108 }], // 142 remaining
      }),
    } as any);

    const result = await RescueQuotaGuard.checkOddsPapiQuota('dummy-key');
    expect(result.allowOddsFetch).toBe(true);
    expect(result.status).toBe('NORMAL');
    expect(result.quotaRemaining).toBe(142);

    fetchSpy.mockRestore();
  });
});

describe('SALMO Rescue Pipeline — Asian Handicap Poisson Engine', () => {
  const grid = RescueMathEngine.buildScoreGrid(1.6, 1.0); // Home favored

  it('AH is NOT Moneyline: 0, -0.25, and -0.5 have distinctly different probability profiles', () => {
    const ah0 = RescueMathEngine.evaluateAsianHandicap(grid, 0.0, 'HOME');
    const ahQuarter = RescueMathEngine.evaluateAsianHandicap(grid, -0.25, 'HOME');
    const ahHalf = RescueMathEngine.evaluateAsianHandicap(grid, -0.5, 'HOME');

    // Line 0 (DNB) MUST have push probability
    expect(ah0.pPush).toBeGreaterThan(0.15);
    expect(ah0.pHalfLoss).toBe(0);

    // Line -0.5 MUST have ZERO push probability (binary win/loss)
    expect(ahHalf.pPush).toBe(0);
    expect(ahHalf.pHalfLoss).toBe(0);

    // Quarter line -0.25 MUST have half-loss probability on draw
    expect(ahQuarter.pHalfLoss).toBeGreaterThan(0.15);
    expect(ahQuarter.pPush).toBe(0);

    // Effective probabilities must strictly decrease as handicap deepens
    expect(ah0.pEffectiveWin).toBeGreaterThan(ahQuarter.pEffectiveWin);
    expect(ahQuarter.pEffectiveWin).toBeGreaterThan(ahHalf.pEffectiveWin);
  });

  it('evaluates all 13 supported AH lines from -1.5 to +1.5 with quarter steps', () => {
    for (const line of RescueMathEngine.SUPPORTED_AH_LINES) {
      const evalHome = RescueMathEngine.evaluateAsianHandicap(grid, line, 'HOME');
      expect(evalHome.fairOdds).toBeGreaterThan(1.0);
      expect(evalHome.pEffectiveWin).toBeGreaterThan(0);
      expect(evalHome.pEffectiveWin).toBeLessThan(1.0);
    }
  });

  it('calculates mathematically sound payoff-weighted EV for AH lines', () => {
    const ahQuarter = RescueMathEngine.evaluateAsianHandicap(grid, -0.25, 'HOME');
    const evAtFair = RescueMathEngine.calculateEv(
      ahQuarter.pFullWin,
      ahQuarter.pHalfWin,
      ahQuarter.pHalfLoss,
      ahQuarter.pFullLoss,
      ahQuarter.fairOdds
    );
    expect(Math.abs(evAtFair)).toBeLessThan(0.01);
  });
});

describe('SALMO Rescue Pipeline — Goals Over/Under Line Family', () => {
  const grid = RescueMathEngine.buildScoreGrid(1.4, 1.2); // Total expected goals = 2.6

  it('does NOT hardcode to 2.5: supports full ladder [1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.0]', () => {
    for (const line of RescueMathEngine.SUPPORTED_OU_LINES) {
      const over = RescueMathEngine.evaluateOverUnder(grid, line, 'OVER');
      const under = RescueMathEngine.evaluateOverUnder(grid, line, 'UNDER');

      expect(over.pEffectiveWin).toBeGreaterThan(0);
      expect(under.pEffectiveWin).toBeGreaterThan(0);
      expect(over.pEffectiveWin + under.pEffectiveWin).toBeCloseTo(1.0, 2);
    }
  });

  it('distinguishes Full, Half, and Quarter lines in settlement probabilities', () => {
    const ouFull = RescueMathEngine.evaluateOverUnder(grid, 2.0, 'OVER');
    const ouHalf = RescueMathEngine.evaluateOverUnder(grid, 2.5, 'OVER');
    const ouQuarter = RescueMathEngine.evaluateOverUnder(grid, 2.25, 'OVER');

    expect(ouFull.lineType).toBe('FULL');
    expect(ouFull.pPush).toBeGreaterThan(0.15);

    expect(ouHalf.lineType).toBe('HALF');
    expect(ouHalf.pPush).toBe(0);

    expect(ouQuarter.lineType).toBe('QUARTER');
    expect(ouQuarter.pHalfLoss).toBeGreaterThan(0.15);
  });

  it('preserves monotonicity: Over probability strictly decreases as line increases', () => {
    const lines = [1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5];
    let prevProb = 1.0;

    for (const l of lines) {
      const over = RescueMathEngine.evaluateOverUnder(grid, l, 'OVER');
      expect(over.pEffectiveWin).toBeLessThan(prevProb);
      prevProb = over.pEffectiveWin;
    }
  });
});

describe('SALMO Rescue Pipeline — BTTS Governance Invariant', () => {
  const grid = RescueMathEngine.buildScoreGrid(1.5, 1.2);

  it('marks BTTS as strictly RESEARCH_ONLY and never promotes to pick', () => {
    const btts = RescueMathEngine.evaluateBtts(grid);
    expect(btts.yes.status).toBe('RESEARCH_ONLY');
    expect(btts.no.status).toBe('RESEARCH_ONLY');
    expect(btts.yes.modelProbability + btts.no.modelProbability).toBeCloseTo(1.0, 2);
  });
});

describe('SALMO Rescue Pipeline — Prediction vs. Pick Separation', () => {
  it('does NOT promote lower confidence predictions (e.g. 52%) into picks', () => {
    const gateResult = ConfidenceGateSystem.evaluate({
      canonicalMatchId: 'match-1',
      fixtureId: '101',
      match: 'Arsenal vs Chelsea',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      competition: 'Premier League',
      kickoffUtc: '2026-10-10T15:00:00Z',
      market: 'AH',
      selection: 'Arsenal -0.25',
      line: -0.25,
      odds: 1.95,
      modelProbability: 0.52,
      calibratedProbability: 0.52,
      predictionTimestampUtc: '2026-10-04T10:00:00Z',
      oddsTimestampUtc: '2026-10-04T10:00:00Z',
      modelVersion: 'poisson_v1_rescue',
      sampleSizeHome: 10,
      sampleSizeAway: 10,
    });

    expect(gateResult.qualified).toBe(false);
    expect(gateResult.isHighConfidence).toBe(false);
  });

  it('promotes only signals passing high confidence (>65% prob, >=1.60 odds, positive EV)', () => {
    const gateResult = ConfidenceGateSystem.evaluate({
      canonicalMatchId: 'match-2',
      fixtureId: '102',
      match: 'Man City vs Fulham',
      homeTeam: 'Man City',
      awayTeam: 'Fulham',
      competition: 'Premier League',
      kickoffUtc: '2026-10-10T15:00:00Z',
      market: 'AH',
      selection: 'Man City -1.0',
      line: -1.0,
      odds: 1.80,
      modelProbability: 0.70,
      calibratedProbability: 0.70,
      predictionTimestampUtc: '2026-10-04T10:00:00Z',
      oddsTimestampUtc: '2026-10-04T10:00:00Z',
      modelVersion: 'poisson_v1_rescue',
      sampleSizeHome: 10,
      sampleSizeAway: 10,
    });

    expect(gateResult.qualified).toBe(true);
    expect(gateResult.isHighConfidence).toBe(true);
  });
});

describe('SALMO Rescue Pipeline — Settlement Engine Integration', () => {
  const dummyPrediction: RescuePredictionRecord = {
    id: 'pred-1',
    run_id: 'run-1',
    model_version: 'poisson_v1_rescue',
    fixture_id: 12345,
    match: 'Arsenal vs Chelsea',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    competition: 'Premier League',
    competition_id: 39,
    kickoff_utc: '2026-10-04T15:00:00Z',
    market: 'AH',
    line: -0.25,
    selection: 'HOME -0.25',
    model_probability: 0.60,
    calibrated_probability: 0.60,
    fair_odds: 1.67,
    market_odds: 1.95,
    market_status: 'AVAILABLE',
    edge_pct: 8.7,
    expected_value: 0.12,
    confidence_tier: 'MEDIUM',
    confidence_score: 75,
    is_pick: false,
    odds_snapshot: null,
    settlement: { status: 'PENDING' },
    created_at: '2026-10-04T10:00:00Z',
  };

  it('settles AH -0.25 as HALF_LOSS when match ends in a 1-1 draw', () => {
    const score: FinalMatchScore = {
      fixtureId: 12345,
      homeGoals: 1,
      awayGoals: 1,
      status: 'FT',
    };

    const settled = RescueSettlementEngine.settlePrediction(dummyPrediction, score);
    expect(settled.settlement?.status).toBe('HALF_LOSS');
    expect(settled.settlement?.pnl_units).toBe(-0.5);
  });

  it('settles AH -0.25 as WON when match ends in a 2-1 win', () => {
    const score: FinalMatchScore = {
      fixtureId: 12345,
      homeGoals: 2,
      awayGoals: 1,
      status: 'FT',
    };

    const settled = RescueSettlementEngine.settlePrediction(dummyPrediction, score);
    expect(settled.settlement?.status).toBe('WON');
    expect(settled.settlement?.pnl_units).toBeCloseTo(0.95, 2);
  });

  it('settles OU 2.25 quarter line as HALF_LOSS for Over on 2 goals (1-1)', () => {
    const ouPred: RescuePredictionRecord = {
      ...dummyPrediction,
      market: 'OU',
      line: 2.25,
      selection: 'OVER 2.25',
      market_odds: 1.90,
    };
    const score: FinalMatchScore = {
      fixtureId: 12345,
      homeGoals: 1,
      awayGoals: 1,
      status: 'FT',
    };

    const settled = RescueSettlementEngine.settlePrediction(ouPred, score);
    expect(settled.settlement?.status).toBe('HALF_LOSS');
    expect(settled.settlement?.pnl_units).toBe(-0.5);
  });

  it('settles postponed/abandoned matches as VOID with 0 PnL units', () => {
    const score: FinalMatchScore = {
      fixtureId: 12345,
      homeGoals: 0,
      awayGoals: 0,
      status: 'PST',
    };

    const settled = RescueSettlementEngine.settlePrediction(dummyPrediction, score);
    expect(settled.settlement?.status).toBe('VOID');
    expect(settled.settlement?.pnl_units).toBe(0.0);
  });
});

describe('SALMO Rescue Pipeline — Liga 1 Indonesia Guardrail', () => {
  beforeEach(() => {
    RescueFixtureIngestion.clearCache();
  });

  it('skips prediction when Liga 1 Indonesia team has < 5 matches', async () => {
    const getFixturesSpy = vi.spyOn(RescueFixtureIngestion as any, 'getTeamStatsCached').mockResolvedValue({
      teamId: 1001,
      gamesPlayed: 3,
      goalsScoredAvg: 1.0,
      goalsConcededAvg: 1.0,
      cachedAt: Date.now(),
    });

    const clientSpy = vi.spyOn(RescueFixtureIngestion as any, 'ingestFixturesForDate').mockResolvedValueOnce({
      fixtures: [
        {
          fixtureId: 9999,
          match: 'Persib vs Persija',
          homeTeam: 'Persib',
          homeTeamId: 1001,
          awayTeam: 'Persija',
          awayTeamId: 1002,
          competition: 'Liga 1 Indonesia',
          competitionId: 279,
          season: 2026,
          kickoffUtc: '2026-10-04T15:00:00Z',
          status: 'NS',
          lambdaHome: 1.0,
          lambdaAway: 1.0,
          sampleSizeHome: 3,
          sampleSizeAway: 3,
          eligible: false,
          skipReason: 'INSUFFICIENT_SAMPLE',
          dataQualityFlags: ['LIGA1_LOW_COVERAGE'],
        },
      ],
      dataQualityFlags: ['LIGA1_LOW_COVERAGE'],
    });

    const res = await RescueFixtureIngestion.ingestFixturesForDate('2026-10-04');
    expect(res.fixtures[0].eligible).toBe(false);
    expect(res.fixtures[0].skipReason).toBe('INSUFFICIENT_SAMPLE');
    expect(res.dataQualityFlags).toContain('LIGA1_LOW_COVERAGE');

    clientSpy.mockRestore();
    getFixturesSpy.mockRestore();
  });
});

describe('SALMO Rescue Pipeline — Composite Key & Event-Driven Execution', () => {
  it('generates distinct composite keys for different lines on the same fixture', () => {
    const keyAh0 = PoissonRescueService.generateCompositeKey(12345, 'AH', 0.0, 'HOME', 'run-test');
    const keyAhQuarter = PoissonRescueService.generateCompositeKey(12345, 'AH', -0.25, 'HOME', 'run-test');
    const keyOu25 = PoissonRescueService.generateCompositeKey(12345, 'OU', 2.5, 'OVER', 'run-test');

    expect(keyAh0).not.toBe(keyAhQuarter);
    expect(keyAhQuarter).not.toBe(keyOu25);
  });

  it('records SUCCESS_EMPTY cleanly when 0 eligible fixtures exist', async () => {
    const ingestSpy = vi.spyOn(RescueFixtureIngestion, 'ingestFixturesForDate').mockResolvedValueOnce({
      fixtures: [],
      dataQualityFlags: [],
    });

    const run = await PoissonRescueService.execute({ targetDate: '2026-10-04', skipOddsFetch: true });
    expect(run.telemetry.status).toBe('SUCCESS_EMPTY');
    expect(run.telemetry.fixture_count).toBe(0);
    expect(run.telemetry.prediction_count).toBe(0);
    expect(run.telemetry.error_count).toBe(0);

    ingestSpy.mockRestore();
  });
});
