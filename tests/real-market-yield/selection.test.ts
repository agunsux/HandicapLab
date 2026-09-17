import { describe, it, expect } from 'vitest';
import {
  SelectionSettlementEngine,
  PinnacleMarketOdds,
} from '../../src/lib/research/real-yield/selectionSettlement';
import { AuditablePrediction } from '../../src/lib/research/real-yield/walkForwardAdapter';

describe('Real Market Yield — Selection Engine Determinism & Constraints', () => {
  const mockPrediction: AuditablePrediction = {
    fixtureId: 'TEST-MATCH|2019-05-12|arsenal|burnley',
    leagueId: 'ENG-PL',
    season: '2018-2019',
    homeTeam: 'Arsenal',
    awayTeam: 'Burnley',
    actualHomeGoals: 3,
    actualAwayGoals: 1,
    kickoffDate: '2019-05-12',
    kickoffTimestamp: '2019-05-12T12:00:00.000Z',
    predictionTimestamp: '2019-05-12T00:00:00.000Z',
    trainingCutoffDate: '2019-05-12',
    trainingObservationCount: 370,
    lastTrainingMatchDate: '2019-05-06',
    modelVersion: 'HierarchicalDixonColes-ModelA-v1',
    modelConfig: { mu: 0.15, gamma: 0.22, rho: -0.05, nTeams: 20 },
    expectedGoals: { homeLambda: 2.1, awayLambda: 0.9 },
    probabilities: {
      pHomeWin: 0.65,
      pDraw: 0.20,
      pAwayWin: 0.15,
      pOver25: 0.60,
      pUnder25: 0.40,
    },
    scoreMatrix: Array(11).fill(0).map(() => Array(11).fill(1 / 121)),
  };

  it('1. Selects at most 1 bet per market for a fixture', () => {
    const mockOdds: PinnacleMarketOdds = {
      canonical_id: mockPrediction.fixtureId,
      league_id: mockPrediction.leagueId,
      season: mockPrediction.season,
      match_date: mockPrediction.kickoffDate,
      ml: { home_odds: 1.80, draw_odds: 4.20, away_odds: 7.50 }, // Home EV = 0.65*1.8 - 1 = +0.17
      ou: { line: 2.5, over_odds: 1.85, under_odds: 2.05 }, // Over EV = 0.60*1.85 - 1 = +0.11
      ah: { line: -1.0, home_odds: 1.95, away_odds: 1.95 },
    };

    const bets = SelectionSettlementEngine.selectBetsForFixture(mockPrediction, mockOdds);
    const mlBets = bets.filter((b) => b.market === '1X2');
    const ouBets = bets.filter((b) => b.market === 'OU_2_5');
    const ahBets = bets.filter((b) => b.market === 'AH');

    expect(mlBets.length).toBeLessThanOrEqual(1);
    expect(ouBets.length).toBeLessThanOrEqual(1);
    expect(ahBets.length).toBeLessThanOrEqual(1);
  });

  it('2. Enforces PRE_REGISTERED_MIN_EV: rejects bets below minEv threshold', () => {
    const mockOddsLowEv: PinnacleMarketOdds = {
      canonical_id: mockPrediction.fixtureId,
      league_id: mockPrediction.leagueId,
      season: mockPrediction.season,
      match_date: mockPrediction.kickoffDate,
      // Home EV = 0.65 * 1.55 - 1 = 0.0075 (< 0.02)
      // Draw EV = 0.20 * 4.80 - 1 = -0.04 (< 0.02)
      // Away EV = 0.15 * 6.50 - 1 = -0.025 (< 0.02)
      ml: { home_odds: 1.55, draw_odds: 4.80, away_odds: 6.50 },
    };

    const bets = SelectionSettlementEngine.selectBetsForFixture(mockPrediction, mockOddsLowEv);
    const mlBets = bets.filter((b) => b.market === '1X2');
    expect(mlBets.length).toBe(0);
  });

  it('3. Deterministic tie-breaking selects highest EV and breaks exact ties deterministically', () => {
    // Exact tie scenario between Home and Draw EV
    const tieOdds: PinnacleMarketOdds = {
      canonical_id: mockPrediction.fixtureId,
      league_id: mockPrediction.leagueId,
      season: mockPrediction.season,
      match_date: mockPrediction.kickoffDate,
      // P(Home) = 0.65, Odds = 2.0 -> EV = 0.30
      // P(Draw) = 0.20, Odds = 6.5 -> EV = 0.30
      ml: { home_odds: 2.00, draw_odds: 6.50, away_odds: 2.00 },
    };

    const bets1 = SelectionSettlementEngine.selectBetsForFixture(mockPrediction, tieOdds);
    const bets2 = SelectionSettlementEngine.selectBetsForFixture(mockPrediction, tieOdds);

    expect(bets1.length).toBe(1);
    expect(bets2.length).toBe(1);
    // Home must win tie-break over Draw
    expect(bets1[0].outcomeSelection).toBe('HOME');
    expect(bets2[0].outcomeSelection).toBe('HOME');
    expect(bets1[0].betId).toBe(bets2[0].betId);
  });
});

