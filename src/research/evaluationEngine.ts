/**
 * Phase 4: Evaluation Engine
 *
 * Calculates prediction accuracy metrics:
 * - Accuracy
 * - Log Loss
 * - Brier Score
 * - Calibration Error
 */

export interface PredictionSnapshot {
  fixtureId: string;
  date: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  homeGoals: number | null;
  awayGoals: number | null;
  actualResult: 'home' | 'draw' | 'away' | null;
  modelVersion: string;
  cutoffDate: string;
}

export interface ModelMetrics {
  modelVersion: string;
  dataset: string;
  matches: number;
  accuracy: number;
  brierScore: number;
  logLoss: number;
  calibrationError: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
  avgHomeProb: number;
  avgDrawProb: number;
  avgAwayProb: number;
}

export interface CalibrationBin {
  binStart: number;
  binEnd: number;
  count: number;
  predicted: number;
  actual: number;
  error: number;
}

export class EvaluationEngine {
  /**
   * Calculate all metrics from prediction snapshots
   */
  evaluate(predictions: PredictionSnapshot[]): ModelMetrics {
    if (predictions.length === 0) {
      return {
        modelVersion: 'unknown',
        dataset: 'none',
        matches: 0,
        accuracy: 0,
        brierScore: 0,
        logLoss: 0,
        calibrationError: 0,
        homeWinRate: 0,
        drawRate: 0,
        awayWinRate: 0,
        avgHomeProb: 0,
        avgDrawProb: 0,
        avgAwayProb: 0,
      };
    }

    const settled = predictions.filter(p => p.actualResult !== null);
    const n = settled.length;

    if (n === 0) {
      return {
        modelVersion: predictions[0].modelVersion,
        dataset: `EPL ${predictions[0].season}`,
        matches: 0,
        accuracy: 0,
        brierScore: 0,
        logLoss: 0,
        calibrationError: 0,
        homeWinRate: 0,
        drawRate: 0,
        awayWinRate: 0,
        avgHomeProb: settled.reduce((s, p) => s + p.homeWinProb, 0) / predictions.length,
        avgDrawProb: settled.reduce((s, p) => s + p.drawProb, 0) / predictions.length,
        avgAwayProb: settled.reduce((s, p) => s + p.awayWinProb, 0) / predictions.length,
      };
    }

    // Accuracy
    const correct = settled.filter(p => this.getPredictedOutcome(p) === p.actualResult).length;
    const accuracy = correct / n;

    // Brier Score: (p - o)^2 where o=1 for actual outcome, 0 otherwise
    // For multi-class: sum of (p_i - o_i)^2 over 3 outcomes
    let brierSum = 0;
    let logLossSum = 0;

    for (const p of settled) {
      const actualVector = this.getActualVector(p.actualResult);
      
      // Brier contribution
      brierSum += Math.pow(p.homeWinProb - actualVector.home, 2);
      brierSum += Math.pow(p.drawProb - actualVector.draw, 2);
      brierSum += Math.pow(p.awayWinProb - actualVector.away, 2);

      // Log Loss
      const eps = 1e-15;
      const homeLL = actualVector.home * Math.log(Math.max(p.homeWinProb, eps));
      const drawLL = actualVector.draw * Math.log(Math.max(p.drawProb, eps));
      const awayLL = actualVector.away * Math.log(Math.max(p.awayWinProb, eps));
      logLossSum += -(homeLL + drawLL + awayLL);
    }

    const brierScore = brierSum / n;
    const logLoss = logLossSum / n;

    // Calibration Error (ECE - Expected Calibration Error)
    const calibrationError = this.calculateCalibrationError(settled);

    // Actual outcome rates
    const homeWins = settled.filter(p => p.actualResult === 'home').length;
    const draws = settled.filter(p => p.actualResult === 'draw').length;
    const awayWins = settled.filter(p => p.actualResult === 'away').length;

    return {
      modelVersion: predictions[0].modelVersion,
      dataset: `EPL ${predictions[0].season}`,
      matches: n,
      accuracy,
      brierScore,
      logLoss,
      calibrationError,
      homeWinRate: homeWins / n,
      drawRate: draws / n,
      awayWinRate: awayWins / n,
      avgHomeProb: settled.reduce((s, p) => s + p.homeWinProb, 0) / n,
      avgDrawProb: settled.reduce((s, p) => s + p.drawProb, 0) / n,
      avgAwayProb: settled.reduce((s, p) => s + p.awayWinProb, 0) / n,
    };
  }

  /**
   * Calculate calibration bins
   */
  calculateCalibration(predictions: PredictionSnapshot[], bins: number = 10): CalibrationBin[] {
    const settled = predictions.filter(p => p.actualResult !== null);
    const binSize = 1.0 / bins;
    const result: CalibrationBin[] = [];

    // Calibrate on home win probability
    for (let i = 0; i < bins; i++) {
      const binStart = i * binSize;
      const binEnd = (i + 1) * binSize;
      
      const inBin = settled.filter(p =>
        p.homeWinProb >= binStart && p.homeWinProb < binEnd
      );

      if (inBin.length === 0) {
        result.push({ binStart, binEnd, count: 0, predicted: 0, actual: 0, error: 0 });
        continue;
      }

      const avgPredicted = inBin.reduce((s, p) => s + p.homeWinProb, 0) / inBin.length;
      const homeWins = inBin.filter(p => p.actualResult === 'home').length;
      const actualRate = homeWins / inBin.length;

      result.push({
        binStart,
        binEnd,
        count: inBin.length,
        predicted: avgPredicted,
        actual: actualRate,
        error: Math.abs(avgPredicted - actualRate),
      });
    }

    return result;
  }

  /**
   * Calculate Expected Calibration Error
   */
  private calculateCalibrationError(predictions: PredictionSnapshot[]): number {
    const bins = this.calculateCalibration(predictions, 10);
    const totalCount = bins.reduce((s, b) => s + b.count, 0);
    
    if (totalCount === 0) return 0;

    const weightedError = bins.reduce((s, b) => {
      return s + (b.count / totalCount) * b.error;
    }, 0);

    return weightedError;
  }

  /**
   * Get predicted outcome (highest probability)
   */
  private getPredictedOutcome(p: PredictionSnapshot): 'home' | 'draw' | 'away' {
    if (p.homeWinProb >= p.drawProb && p.homeWinProb >= p.awayWinProb) return 'home';
    if (p.drawProb >= p.homeWinProb && p.drawProb >= p.awayWinProb) return 'draw';
    return 'away';
  }

  /**
   * Get one-hot encoded actual outcome vector
   */
  private getActualVector(result: 'home' | 'draw' | 'away'): { home: number; draw: number; away: number } {
    switch (result) {
      case 'home': return { home: 1, draw: 0, away: 0 };
      case 'draw': return { home: 0, draw: 1, away: 0 };
      case 'away': return { home: 0, draw: 0, away: 1 };
    }
  }
}