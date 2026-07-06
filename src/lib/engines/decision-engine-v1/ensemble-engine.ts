// HandicapLab Decision Engine v1 - Ensemble Engine
// Location: src/lib/engines/decision-engine-v1/ensemble-engine.ts

import * as fs from 'fs';
import * as path from 'path';
import { ModelRegistry, ModelPrediction } from './registry';
import { MatchFeatures } from '../feature-engine/types';

export interface EnsemblePrediction {
  pHome: number;
  pDraw: number;
  pAway: number;
  modelConfidence: number; // Blended model confidence (0-100)
  disagreementScore: number; // Normalized disagreement score (0-100)
  individualPredictions: Record<string, ModelPrediction>;
}

export interface WeightOptimizer {
  optimizeWeights(historicalData: any[]): Promise<Record<string, number>>;
}

export class EnsembleEngine {
  private static weights: Record<string, number> = {};

  /**
   * Loads weight configuration from model_weights.json.
   */
  public static loadWeights(): Record<string, number> {
    try {
      const filePath = path.join(__dirname, 'model_weights.json');
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        this.weights = JSON.parse(fileContent);
      } else {
        // Fallback default weights
        this.weights = {
          poisson: 0.20,
          dixonColes: 0.20,
          elo: 0.20,
          logistic: 0.20,
          xg: 0.20,
          market: 0.00
        };
      }
    } catch (e) {
      // Graceful error fallback
      this.weights = {
        poisson: 0.20,
        dixonColes: 0.20,
        elo: 0.20,
        logistic: 0.20,
        xg: 0.20,
        market: 0.00
      };
    }
    return this.weights;
  }

  /**
   * Set custom weights directly (useful for testing or optimization).
   */
  public static setWeights(customWeights: Record<string, number>): void {
    this.weights = { ...customWeights };
  }

  /**
   * Calculates the standard deviation of outcomes to derive the Disagreement Index.
   */
  private static calculateDisagreement(predictions: ModelPrediction[]): number {
    if (predictions.length <= 1) return 0;

    let sumSqHome = 0;
    let sumSqDraw = 0;
    let sumSqAway = 0;

    const meanHome = predictions.reduce((sum, p) => sum + p.pHome, 0) / predictions.length;
    const meanDraw = predictions.reduce((sum, p) => sum + p.pDraw, 0) / predictions.length;
    const meanAway = predictions.reduce((sum, p) => sum + p.pAway, 0) / predictions.length;

    predictions.forEach(p => {
      sumSqHome += Math.pow(p.pHome - meanHome, 2);
      sumSqDraw += Math.pow(p.pDraw - meanDraw, 2);
      sumSqAway += Math.pow(p.pAway - meanAway, 2);
    });

    const sdHome = Math.sqrt(sumSqHome / predictions.length);
    const sdDraw = Math.sqrt(sumSqDraw / predictions.length);
    const sdAway = Math.sqrt(sumSqAway / predictions.length);

    // Average standard deviation across outcomes, scaled to 0-100 range
    // Theoretical max SD for probabilities is ~0.50, so multiplying by 200 normalizes to 0-100
    const avgSD = (sdHome + sdDraw + sdAway) / 3;
    const disagreement = Math.min(100, Math.round(avgSD * 200));

    return disagreement;
  }

  /**
   * Predicts ensembled outcome probabilities across all registered models.
   */
  public static async predict(features: MatchFeatures): Promise<EnsemblePrediction> {
    const models = ModelRegistry.getModels();
    if (models.length === 0) {
      throw new Error("No prediction models registered in ModelRegistry.");
    }

    const weights = Object.keys(this.weights).length > 0 ? this.weights : this.loadWeights();

    let totalWeight = 0;
    let weightedHome = 0;
    let weightedDraw = 0;
    let weightedAway = 0;
    let weightedConfidence = 0;

    const individualPredictions: Record<string, ModelPrediction> = {};
    const predictionsList: ModelPrediction[] = [];

    for (const model of models) {
      const prediction = await model.predict(features);
      individualPredictions[model.id] = prediction;
      predictionsList.push(prediction);

      const weight = weights[model.id] !== undefined ? weights[model.id] : 1.0;
      weightedHome += prediction.pHome * weight;
      weightedDraw += prediction.pDraw * weight;
      weightedAway += prediction.pAway * weight;
      weightedConfidence += prediction.confidence * weight;
      totalWeight += weight;
    }

    if (totalWeight <= 0) {
      totalWeight = models.length;
      weightedHome = predictionsList.reduce((sum, p) => sum + p.pHome, 0);
      weightedDraw = predictionsList.reduce((sum, p) => sum + p.pDraw, 0);
      weightedAway = predictionsList.reduce((sum, p) => sum + p.pAway, 0);
      weightedConfidence = predictionsList.reduce((sum, p) => sum + p.confidence, 0);
    }

    const pHome = Number((weightedHome / totalWeight).toFixed(4));
    const pDraw = Number((weightedDraw / totalWeight).toFixed(4));
    const pAway = Number(Math.max(0, 1.0 - pHome - pDraw).toFixed(4));
    const modelConfidence = Math.round(weightedConfidence / totalWeight);

    const disagreementScore = this.calculateDisagreement(predictionsList);

    return {
      pHome,
      pDraw,
      pAway,
      modelConfidence,
      disagreementScore,
      individualPredictions
    };
  }
}
