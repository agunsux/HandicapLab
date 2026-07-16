/**
 * Phase 2: Prediction Models
 *
 * Baseline probability models for football match outcomes.
 * All models output probabilities that sum to 1.0 (100%).
 */

export interface PredictionResult {
  fixtureId: string;
  prediction: {
    homeWinProbability: number;
    drawProbability: number;
    awayWinProbability: number;
  };
  expectedGoals: {
    home: number;
    away: number;
  };
  modelVersion: string;
  dataCutoffDate: string;
}

export interface ModelInput {
  fixtureId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeXG: number;
  awayXG: number;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

/**
 * Base class for all prediction models
 */
export abstract class BasePredictionModel {
  abstract readonly version: string;

  /**
   * Predict match outcome probabilities.
   * Must ensure probabilities sum to 1.0.
   */
  abstract predict(match: ModelInput): PredictionResult;

  /**
   * Validate that probabilities sum to 1.0 (± floating point tolerance)
   */
  protected validateProbabilities(p: { home: number; draw: number; away: number }): void {
    const sum = p.home + p.draw + p.away;
    if (Math.abs(sum - 1.0) > 0.001) {
      console.warn(`Probability sum ${sum} != 1.0 (home=${p.home}, draw=${p.draw}, away=${p.away})`);
    }
  }

  /**
   * Normalize probabilities to ensure they sum to 1.0
   */
  protected normalize(p: { home: number; draw: number; away: number }): { home: number; draw: number; away: number } {
    const sum = p.home + p.draw + p.away;
    if (sum === 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
    return {
      home: p.home / sum,
      draw: p.draw / sum,
      away: p.away / sum,
    };
  }
}

/**
 * Model 1: Poisson xG Model
 *
 * Assumes goals follow a Poisson distribution with lambda = xG.
 * Calculates match outcome probabilities using the Poisson PMF.
 */
export class PoissonXGModel extends BasePredictionModel {
  readonly version = 'poisson-xg-v1';

  predict(match: ModelInput): PredictionResult {
    const homeLambda = Math.max(match.homeXG, 0.01);
    const awayLambda = Math.max(match.awayXG, 0.01);

    // Calculate Poisson probabilities for goals 0-10
    const maxGoals = 10;
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const prob = this.poissonPMF(h, homeLambda) * this.poissonPMF(a, awayLambda);
        if (h > a) homeWin += prob;
        else if (h === a) draw += prob;
        else awayWin += prob;
      }
    }

    const normalized = this.normalize({ home: homeWin, draw, away: awayWin });

    return {
      fixtureId: match.fixtureId,
      prediction: {
        homeWinProbability: normalized.home,
        drawProbability: normalized.draw,
        awayWinProbability: normalized.away,
      },
      expectedGoals: { home: homeLambda, away: awayLambda },
      modelVersion: this.version,
      dataCutoffDate: match.date,
    };
  }

  private poissonPMF(k: number, lambda: number): number {
    return Math.exp(-lambda) * Math.pow(lambda, k) / this.factorial(k);
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }
}

/**
 * Model 2: Simple xG Strength Model
 *
 * Uses team-level attacking/defending strength derived from xG.
 * win/draw/away proportions based on strength differential.
 */
export class SimpleXGStrengthModel extends BasePredictionModel {
  readonly version = 'xg-strength-v1';

  // Empirical baseline from historical EPL data
  private readonly BASE_HOME_WIN = 0.46;
  private readonly BASE_DRAW = 0.24;
  private readonly BASE_AWAY_WIN = 0.30;

  predict(match: ModelInput): PredictionResult {
    // Calculate strength differential
    const xGDiff = match.homeXG - match.awayXG;

    // Logistic transformation to convert xG difference to probability adjustment
    const strengthFactor = 1 / (1 + Math.exp(-xGDiff * 0.8));

    // Adjust baseline probabilities
    const homeWin = this.BASE_HOME_WIN + (strengthFactor - 0.5) * 0.3;
    const awayWin = this.BASE_AWAY_WIN - (strengthFactor - 0.5) * 0.3;
    const draw = 1 - homeWin - awayWin;

    const normalized = this.normalize({ home: homeWin, draw, away: awayWin });

    return {
      fixtureId: match.fixtureId,
      prediction: {
        homeWinProbability: normalized.home,
        drawProbability: normalized.draw,
        awayWinProbability: normalized.away,
      },
      expectedGoals: {
        home: match.homeXG,
        away: match.awayXG,
      },
      modelVersion: this.version,
      dataCutoffDate: match.date,
    };
  }
}

/**
 * Model 3: Historical Baseline Model
 *
 * Uses fixed empirical probabilities from EPL history.
 * Serves as a naive baseline for comparison.
 */
export class HistoricalBaselineModel extends BasePredictionModel {
  readonly version = 'historical-baseline-v1';
  private readonly HOME_WIN = 0.46;
  private readonly DRAW = 0.24;
  private readonly AWAY_WIN = 0.30;

  predict(match: ModelInput): PredictionResult {
    return {
      fixtureId: match.fixtureId,
      prediction: {
        homeWinProbability: this.HOME_WIN,
        drawProbability: this.DRAW,
        awayWinProbability: this.AWAY_WIN,
      },
      expectedGoals: {
        home: match.homeXG,
        away: match.awayXG,
      },
      modelVersion: this.version,
      dataCutoffDate: match.date,
    };
  }
}

/**
 * Model 4: Dixon-Coles Approximation
 *
 * Uses a simplified Dixon-Coles approach with xG as intensity.
 * Adjusts for low-scoring match correlation.
 */
export class DixonColesModel extends BasePredictionModel {
  readonly version = 'dixon-coles-v1';

  // Dixon-Coles adjustment for low-scoring draws (rho parameter)
  private readonly RHO = -0.15;

  predict(match: ModelInput): PredictionResult {
    const homeLambda = Math.max(match.homeXG, 0.01);
    const awayLambda = Math.max(match.awayXG, 0.01);

    const maxGoals = 10;
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        let prob = this.poissonPMF(h, homeLambda) * this.poissonPMF(a, awayLambda);

        // Dixon-Coles adjustment for 0-0 and 1-1 scores
        if (h === 0 && a === 0) {
          prob *= (1 + this.RHO * homeLambda * awayLambda);
        } else if (h === 0 && a === 1) {
          prob *= (1 - this.RHO * awayLambda);
        } else if (h === 1 && a === 0) {
          prob *= (1 - this.RHO * homeLambda);
        } else if (h === 1 && a === 1) {
          prob *= (1 + this.RHO);
        }

        if (h > a) homeWin += prob;
        else if (h === a) draw += prob;
        else awayWin += prob;
      }
    }

    const normalized = this.normalize({ home: homeWin, draw, away: awayWin });

    return {
      fixtureId: match.fixtureId,
      prediction: {
        homeWinProbability: normalized.home,
        drawProbability: normalized.draw,
        awayWinProbability: normalized.away,
      },
      expectedGoals: {
        home: homeLambda,
        away: awayLambda,
      },
      modelVersion: this.version,
      dataCutoffDate: match.date,
    };
  }

  private poissonPMF(k: number, lambda: number): number {
    return Math.exp(-lambda) * Math.pow(lambda, k) / this.factorial(k);
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }
}

/**
 * Model Registry - access all available models
 */
export function getAvailableModels(): BasePredictionModel[] {
  return [
    new HistoricalBaselineModel(),
    new PoissonXGModel(),
    new SimpleXGStrengthModel(),
    new DixonColesModel(),
  ];
}

export function getModelByName(name: string): BasePredictionModel {
  const models = getAvailableModels();
  const model = models.find(m => m.version === name);
  if (!model) throw new Error(`Unknown model: ${name}`);
  return model;
}