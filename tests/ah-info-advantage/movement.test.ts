import { describe, it, expect } from 'vitest';
import { runLineMovementStudy } from '../../src/lib/research/ah-info-advantage/infoExperiments';
import type { InfoBetPrediction, InfoMatch } from '../../src/lib/research/ah-info-advantage/infoTypes';

function makeMockPrediction(overrides: Partial<InfoBetPrediction> = {}): InfoBetPrediction {
  return {
    canonicalId: 'M1',
    matchDate: '2024-11-01',
    season: '2024-2025',
    leagueId: 'ENG-PL',
    side: 'home',
    line: -0.5,
    odds: 1.95,
    oppositeOdds: 1.95,
    closingOdds: 1.85,
    closingLine: -0.5,
    favoriteStatus: 'favorite',
    actualOutcome: 'HOME_WIN',
    actualCategoryIndex: 0,
    y: 1,
    pnl: 0.95,
    modelId: 'M7',
    probabilities: { pFullWin: 0.55, pHalfWin: 0, pPush: 0, pHalfLoss: 0, pFullLoss: 0.45 },
    modelBinaryProbability: 0.55,
    marketBinaryProbability: 0.50,
    modelEv: 0.0725,
    clv: 0.054,
    movementPattern: 'PRICE_COMPRESSION',
    ...overrides,
  };
}

describe('AH Info Advantage — Line Movement Study Tests', () => {
  it('correctly aggregates metrics across predefined structural movement patterns', () => {
    const preds: InfoBetPrediction[] = [
      makeMockPrediction({ movementPattern: 'LINE_MOVES_TOWARD_FAVORITE', y: 1, actualOutcome: 'HOME_WIN' }),
      makeMockPrediction({ movementPattern: 'LINE_MOVES_TOWARD_FAVORITE', y: 0, actualOutcome: 'AWAY_WIN' }),
      makeMockPrediction({ movementPattern: 'PRICE_COMPRESSION', y: 1, actualOutcome: 'HOME_WIN' }),
    ];

    const results = runLineMovementStudy([], preds);
    expect(results.length).toBe(7);

    const favMove = results.find((r) => r.pattern === 'LINE_MOVES_TOWARD_FAVORITE');
    expect(favMove).toBeDefined();
    expect(favMove?.n).toBe(2);
    expect(favMove?.wins).toBe(1);
    expect(favMove?.losses).toBe(1);
    expect(favMove?.hitRate).toBe(50);

    const priceComp = results.find((r) => r.pattern === 'PRICE_COMPRESSION');
    expect(priceComp?.n).toBe(1);
    expect(priceComp?.wins).toBe(1);
    expect(priceComp?.hitRate).toBe(100);
  });
});
