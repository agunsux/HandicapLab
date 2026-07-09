// HandicapLab Data Platform - Feature Importance
import { PredictionModel } from '../engines/decision-engine-v1/models/predictionModel';

export interface ImportanceResult {
  featureName: string;
  importanceScore: number;
}

export class FeatureImportance {
  /**
   * Calculates Permutation Importance for a given model and dataset.
   * Shuffles each feature one by one and measures the drop in Brier Score or LogLoss.
   */
  public static async permutationImportance(
    model: PredictionModel,
    testData: any[],
    featureKeys: string[],
    metricFn: (predictions: any[]) => number,
    higherIsBetter = false,
    randomSeed = 42
  ): Promise<ImportanceResult[]> {
    if (testData.length === 0 || featureKeys.length === 0) return [];

    // 1. Get baseline predictions and metric
    const baselinePredictions: any[] = [];
    for (const match of testData) {
      const pred = await model.predict(match);
      const outcome = match.fullTimeHomeGoals > match.fullTimeAwayGoals ? 1 : 0;
      baselinePredictions.push({ probability: pred.pHome, outcome });
    }
    const baselineScore = metricFn(baselinePredictions);

    const importance: ImportanceResult[] = [];

    // Seeded random number generator
    let seed = randomSeed;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // 2. Iterate over each feature
    for (const key of featureKeys) {
      // Shuffle the specific feature across the dataset
      const shuffledData = testData.map(match => ({ ...match }));
      const values = shuffledData.map(match => match[key]);
      
      // Fisher-Yates shuffle
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }

      for (let i = 0; i < shuffledData.length; i++) {
        shuffledData[i][key] = values[i];
      }

      // Re-predict with shuffled feature
      const shuffledPredictions: any[] = [];
      for (let i = 0; i < shuffledData.length; i++) {
        const pred = await model.predict(shuffledData[i]);
        const outcome = testData[i].fullTimeHomeGoals > testData[i].fullTimeAwayGoals ? 1 : 0;
        shuffledPredictions.push({ probability: pred.pHome, outcome });
      }

      const shuffledScore = metricFn(shuffledPredictions);
      
      // Calculate importance: Drop in performance (if higher is better: baseline - shuffled)
      const score = higherIsBetter ? (baselineScore - shuffledScore) : (shuffledScore - baselineScore);
      importance.push({ featureName: key, importanceScore: score });
    }

    // Sort by importance descending
    importance.sort((a, b) => b.importanceScore - a.importanceScore);
    return importance;
  }
}
