import { describe, it, expect } from 'vitest';
import { extractFeatureVector } from '../../src/lib/research/ah-info-advantage/infoModels';
import type { InfoMatch, InfoPointInTimeFeatures } from '../../src/lib/research/ah-info-advantage/infoTypes';

function makeMockMatch(overrides: Partial<InfoMatch> = {}): InfoMatch {
  const emptyFeatures: InfoPointInTimeFeatures = {
    formPpg3Home: 1.5, formPpg3Away: 1.0, formGf3Home: 2, formGf3Away: 1, formGa3Home: 1, formGa3Away: 2, formGd3Home: 1, formGd3Away: -1,
    formPpg5Home: 1.6, formPpg5Away: 1.2, formGf5Home: 2, formGf5Away: 1, formGa5Home: 1, formGa5Away: 2, formGd5Home: 1, formGd5Away: -1,
    formPpg10Home: 1.5, formPpg10Away: 1.1, formGf10Home: 1.8, formGf10Away: 1.2, formGa10Home: 1.2, formGa10Away: 1.8, formGd10Home: 0.6, formGd10Away: -0.6,
    homeFormPpg: 2.0, homeFormGf: 2.2, homeFormGa: 0.8, awayFormPpg: 0.8, awayFormGf: 1.0, awayFormGa: 2.0,
    ppmHome: 1.7, ppmAway: 1.1,
    eloHome: 1600, eloAway: 1450, eloDiff: 210,
    rollingStrengthHome: 0.8, rollingStrengthAway: -0.4, oppAdjustedStrengthHome: 0.85, oppAdjustedStrengthAway: -0.42,
    restDaysHome: 7, restDaysAway: 4, restDiff: 3, homeAdvantageGoals: 0.35,
    seasonProgressionHome: 10, seasonProgressionAway: 10, scheduleDensity14dHome: 2, scheduleDensity14dAway: 3,
    leagueGoalsPerMatch: 2.7, teamSeasonGfHome: 1.8, teamSeasonGaHome: 1.0, teamSeasonGfAway: 1.2, teamSeasonGaAway: 1.6,
  };

  return {
    canonicalId: 'TEST-1',
    leagueId: 'ENG-PL',
    season: '2024-2025',
    matchDate: '2024-10-15',
    homeTeam: 'HomeTeam',
    awayTeam: 'AwayTeam',
    homeGoals: 2,
    awayGoals: 1,
    earlyAh: { line: -0.5, homeOdds: 1.95, awayOdds: 1.95 },
    earlyMl: { pHome: 0.5, pDraw: 0.25, pAway: 0.25 },
    earlyOuOver25: 0.55,
    closingAh: { line: -0.75, homeOdds: 1.85, awayOdds: 2.05 },
    closingMl: { pHome: 0.55, pDraw: 0.25, pAway: 0.20 },
    closingOuOver25: 0.60,
    movementPattern: 'LINE_MOVES_TOWARD_FAVORITE',
    lineMovementHome: -0.25,
    priceMovementHome: -0.10,
    probMovementHome: 0.05,
    features: emptyFeatures,
    ...overrides,
  };
}

describe('AH Info Advantage — Leakage & Snapshot Isolation', () => {
  it('strictly isolates Early prediction vector from Closing odds and lines', () => {
    const m = makeMockMatch();
    const earlyVector = extractFeatureVector(m, 'home', ['market'], 'early');
    const closingVector = extractFeatureVector(m, 'home', ['market'], 'closing');

    // Early vector must reflect early line (-0.5) and early price (1.95)
    expect(earlyVector[0]).toBe(-0.5);
    expect(earlyVector[1]).toBe(1.95);
    expect(earlyVector[2]).toBe(0.5); // early pHome
    expect(earlyVector[5]).toBe(0.55); // early Over 2.5

    // Closing vector must reflect closing line (-0.75) and closing price (1.85)
    expect(closingVector[0]).toBe(-0.75);
    expect(closingVector[1]).toBe(1.85);
    expect(closingVector[2]).toBe(0.55); // closing pHome
    expect(closingVector[5]).toBe(0.60); // closing Over 2.5

    // Mutating closing values in match object does not change early vector
    const mutated = makeMockMatch({
      closingAh: { line: -2.5, homeOdds: 1.05, awayOdds: 9.0 },
      closingMl: { pHome: 0.9, pDraw: 0.08, pAway: 0.02 },
      closingOuOver25: 0.99,
    });
    const earlyVectorAfterMutation = extractFeatureVector(mutated, 'home', ['market'], 'early');
    expect(earlyVectorAfterMutation).toEqual(earlyVector);
  });

  it('verifies F0 (football only) contains zero market features', () => {
    const m = makeMockMatch();
    const f0Vector = extractFeatureVector(m, 'home', ['form', 'strength', 'context', 'goal_env'], 'early');

    // F0 vector must not contain any market lines or odds
    // First element of form is ppg3Home (1.5)
    expect(f0Vector[0]).toBe(1.5);
    // Does not equal market line (-0.5) or market price (1.95)
    expect(f0Vector).not.toContain(1.95);
  });
});
