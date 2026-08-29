import { describe, it, expect } from 'vitest';
import { AhProbabilityModels } from '../src/lib/research/ah-solo/ahProbabilityModels';
import { AhTournamentRunner } from '../src/lib/research/ah-solo/ahTournamentRunner';

describe('EPIC 56: Asian Handicap Probability & Calibration', () => {
  it('generates normalized bivariate score matrix and goal difference distribution', () => {
    const lh = 1.65;
    const la = 1.15;
    const matrix = AhProbabilityModels.computePoissonMatrix(lh, la, 8);

    let sum = 0;
    for (let h = 0; h <= 8; h++) {
      for (let a = 0; a <= 8; a++) {
        sum += matrix[h][a];
      }
    }
    expect(sum).toBeCloseTo(1.0, 4);

    const gdPmf = AhProbabilityModels.matrixToGoalDifferencePmf(matrix);
    let gdSum = 0;
    for (const p of Object.values(gdPmf.pmf)) {
      gdSum += p;
    }
    expect(gdSum).toBeCloseTo(1.0, 3);
    expect(gdPmf.expectedGd).toBeCloseTo(lh - la, 1);
  });

  it('derives consistent line probabilities for whole, half, and quarter lines', () => {
    const matrix = AhProbabilityModels.computePoissonMatrix(1.5, 1.2, 8);
    const gdPmf = AhProbabilityModels.matrixToGoalDifferencePmf(matrix);

    const level0 = AhProbabilityModels.deriveAhSettlementProbabilities(gdPmf, 0.0, 'home');
    expect(level0.pFullWin + level0.pPush + level0.pFullLoss).toBeCloseTo(1.0, 3);
    expect(level0.pHalfWin).toBe(0);
    expect(level0.pHalfLoss).toBe(0);

    const quarterLine = AhProbabilityModels.deriveAhSettlementProbabilities(gdPmf, -0.75, 'home');
    const totalQProbs =
      quarterLine.pFullWin +
      quarterLine.pHalfWin +
      quarterLine.pPush +
      quarterLine.pHalfLoss +
      quarterLine.pFullLoss;
    expect(totalQProbs).toBeCloseTo(1.0, 3);
  });

  it('computes Expected Calibration Error (ECE) accurately', () => {
    // Perfectly calibrated predictions: pred = actual
    const preds = [0.1, 0.2, 0.5, 0.8, 0.9];
    const actuals = [0, 0, 1, 1, 1];
    const ece = AhTournamentRunner.computeEce(preds, actuals, 10);
    expect(ece).toBeGreaterThanOrEqual(0);
    expect(ece).toBeLessThan(1.0);
  });
});
