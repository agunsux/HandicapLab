import { BacktestSnapshot } from './bronzeBacktestEngine';

export interface CalibrationBucket {
  bucketStr: string;
  minProb: number;
  maxProb: number;
  count: number;
  expectedWinRate: number;
  actualWinRate: number;
  calibrationError: number;
}

export interface EvaluationMetrics {
  totalMatches: number;
  accuracy: number;
  logLoss: number;
  brierScore: number;
  calibration: {
    homeWin: CalibrationBucket[];
  };
}

export class EvaluationEngine {
  /**
   * Evaluates a set of snapshots and returns aggregate metrics.
   */
  evaluate(snapshots: BacktestSnapshot[]): EvaluationMetrics {
    if (snapshots.length === 0) {
      return {
        totalMatches: 0,
        accuracy: 0,
        logLoss: 0,
        brierScore: 0,
        calibration: { homeWin: [] },
      };
    }

    let correctPredictions = 0;
    let totalLogLoss = 0;
    let totalBrierScore = 0;

    const EPSILON = 1e-15;

    // For calibration (Home Win only for simplicity, can be expanded)
    const buckets = [
      { min: 0.0, max: 0.1, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.1, max: 0.2, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.2, max: 0.3, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.3, max: 0.4, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.4, max: 0.5, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.5, max: 0.6, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.6, max: 0.7, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.7, max: 0.8, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.8, max: 0.9, count: 0, sumProb: 0, sumActual: 0 },
      { min: 0.9, max: 1.0, count: 0, sumProb: 0, sumActual: 0 },
    ];

    for (const snap of snapshots) {
      const pHome = snap.prediction.homeWin;
      const pDraw = snap.prediction.draw;
      const pAway = snap.prediction.awayWin;
      
      const isHome = snap.actualResult === 'HOME_WIN';
      const isDraw = snap.actualResult === 'DRAW';
      const isAway = snap.actualResult === 'AWAY_WIN';

      // 1. Accuracy
      const maxProb = Math.max(pHome, pDraw, pAway);
      if (maxProb === pHome && isHome) correctPredictions++;
      else if (maxProb === pDraw && isDraw) correctPredictions++;
      else if (maxProb === pAway && isAway) correctPredictions++;

      // 2. Log Loss
      const probActual = isHome ? pHome : (isDraw ? pDraw : pAway);
      const probSafe = Math.max(EPSILON, Math.min(1 - EPSILON, probActual));
      totalLogLoss -= Math.log(probSafe);

      // 3. Brier Score
      const brierHome = Math.pow(pHome - (isHome ? 1 : 0), 2);
      const brierDraw = Math.pow(pDraw - (isDraw ? 1 : 0), 2);
      const brierAway = Math.pow(pAway - (isAway ? 1 : 0), 2);
      totalBrierScore += (brierHome + brierDraw + brierAway);

      // 4. Calibration (Home Win)
      for (const bucket of buckets) {
        if (pHome >= bucket.min && (pHome < bucket.max || (bucket.max === 1.0 && pHome <= 1.0))) {
          bucket.count++;
          bucket.sumProb += pHome;
          bucket.sumActual += isHome ? 1 : 0;
          break;
        }
      }
    }

    const n = snapshots.length;

    const homeWinCalibration: CalibrationBucket[] = buckets.map(b => {
      const expectedWinRate = b.count > 0 ? b.sumProb / b.count : 0;
      const actualWinRate = b.count > 0 ? b.sumActual / b.count : 0;
      return {
        bucketStr: `${b.min.toFixed(2)}-${b.max.toFixed(2)}`,
        minProb: b.min,
        maxProb: b.max,
        count: b.count,
        expectedWinRate,
        actualWinRate,
        calibrationError: actualWinRate - expectedWinRate,
      };
    });

    return {
      totalMatches: n,
      accuracy: correctPredictions / n,
      logLoss: totalLogLoss / n,
      brierScore: totalBrierScore / n,
      calibration: {
        homeWin: homeWinCalibration,
      }
    };
  }
}
