import { describe, it, expect } from 'vitest';
import { StrictWalkForwardAdapter } from '../../src/lib/research/real-yield/walkForwardAdapter';
import { CanonicalMatch } from '../../src/lib/research/model-a/types';

describe('Real Market Yield — Walk-Forward Engine Robustness', () => {
  it('1. Verifies invariance to future data: deleting future matches yields identical predictions', async () => {
    const matches = await StrictWalkForwardAdapter.loadCanonicalMatches();
    const targetFixture = matches.find(
      (m) => m.leagueId === 'ENG-PL' && m.matchDate === '2019-02-02' && m.homeTeam === 'Tottenham'
    );
    expect(targetFixture).toBeDefined();

    // Prediction with full dataset
    const fullPred = StrictWalkForwardAdapter.predictFixture(targetFixture!, matches);

    // Prediction with truncated dataset where all future matches (> 2019-02-02) are removed
    const truncatedMatches = matches.filter((m) => m.matchDate <= targetFixture!.matchDate);
    const truncatedPred = StrictWalkForwardAdapter.predictFixture(targetFixture!, truncatedMatches);

    // Assert exact equality down to 10 decimal places
    expect(fullPred.probabilities.pHomeWin).toBe(truncatedPred.probabilities.pHomeWin);
    expect(fullPred.probabilities.pDraw).toBe(truncatedPred.probabilities.pDraw);
    expect(fullPred.probabilities.pAwayWin).toBe(truncatedPred.probabilities.pAwayWin);
    expect(fullPred.probabilities.pOver25).toBe(truncatedPred.probabilities.pOver25);
    expect(fullPred.probabilities.pUnder25).toBe(truncatedPred.probabilities.pUnder25);
    expect(fullPred.expectedGoals.homeLambda).toBe(truncatedPred.expectedGoals.homeLambda);
    expect(fullPred.expectedGoals.awayLambda).toBe(truncatedPred.expectedGoals.awayLambda);
    expect(fullPred.trainingObservationCount).toBe(truncatedPred.trainingObservationCount);
  });

  it('2. Verifies strictly chronological processing in cohort execution', async () => {
    const matches = await StrictWalkForwardAdapter.loadCanonicalMatches();
    const subCohort = matches.filter((m) => m.season === '2016-2017').slice(0, 50);

    const predictions = await StrictWalkForwardAdapter.executeWalkForwardCohort(subCohort);
    for (let i = 1; i < predictions.length; i++) {
      const prev = predictions[i - 1];
      const curr = predictions[i];
      // Date must be non-decreasing
      expect(curr.kickoffDate >= prev.kickoffDate).toBe(true);
    }
  });
});

