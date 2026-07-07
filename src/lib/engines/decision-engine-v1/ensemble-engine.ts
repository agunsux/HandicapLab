// HandicapLab Decision Engine v1 - Hierarchical Ensemble Engine
import { ModelRegistry } from './registry';
import { Prediction } from './models/predictionModel';
import { calibrationRouter, CalibrationRouter } from '../../ml-platform/calibration/router';

export type EnsembleLevel = 'simple_average' | 'weighted_average' | 'bayesian_average' | 'stacking' | 'dynamic_online';

export interface EnsembleConfig {
  level: EnsembleLevel;
  weights?: Record<string, number>;
  metaLearnerWeights?: Record<string, number>; // for stacking
}

export interface EnsemblePrediction extends Prediction {
  modelConfidence: number;
  disagreementScore: number;
  individualPredictions: Record<string, Prediction>;
}

export class EnsembleEngine {
  private static config: EnsembleConfig = { level: 'simple_average' };

  public static setConfig(config: EnsembleConfig) {
    this.config = config;
  }

  private static calculateDisagreement(predictions: Prediction[]): number {
    if (predictions.length <= 1) return 0;
    
    const meanHome = predictions.reduce((s, p) => s + p.pHome, 0) / predictions.length;
    const meanDraw = predictions.reduce((s, p) => s + p.pDraw, 0) / predictions.length;
    const meanAway = predictions.reduce((s, p) => s + p.pAway, 0) / predictions.length;

    let sumSqH = 0, sumSqD = 0, sumSqA = 0;
    predictions.forEach(p => {
      sumSqH += Math.pow(p.pHome - meanHome, 2);
      sumSqD += Math.pow(p.pDraw - meanDraw, 2);
      sumSqA += Math.pow(p.pAway - meanAway, 2);
    });

    const sdH = Math.sqrt(sumSqH / predictions.length);
    const sdD = Math.sqrt(sumSqD / predictions.length);
    const sdA = Math.sqrt(sumSqA / predictions.length);

    const avgSD = (sdH + sdD + sdA) / 3;
    return Math.min(100, Math.round(avgSD * 200));
  }

  public static async predict(features: any, context?: { leagueId?: string, marketType?: string }): Promise<EnsemblePrediction> {
    const models = ModelRegistry.getModels();
    if (models.length === 0) throw new Error("No models registered.");

    const individualPredictions: Record<string, Prediction> = {};
    const predictionsList: Prediction[] = [];
    
    for (const { id, model } of models) {
      const pred = await model.predict(features);
      individualPredictions[id] = pred;
      predictionsList.push(pred);
    }

    let finalHome = 0, finalDraw = 0, finalAway = 0;

    if (this.config.level === 'simple_average') {
      finalHome = predictionsList.reduce((s, p) => s + p.pHome, 0) / models.length;
      finalDraw = predictionsList.reduce((s, p) => s + p.pDraw, 0) / models.length;
      finalAway = predictionsList.reduce((s, p) => s + p.pAway, 0) / models.length;
    } 
    else if (this.config.level === 'weighted_average' || this.config.level === 'dynamic_online') {
      const weights = this.config.weights || {};
      let totalW = 0;
      for (const { id } of models) {
        const w = weights[id] ?? (1.0 / models.length);
        const p = individualPredictions[id];
        finalHome += p.pHome * w;
        finalDraw += p.pDraw * w;
        finalAway += p.pAway * w;
        totalW += w;
      }
      if (totalW > 0) {
        finalHome /= totalW;
        finalDraw /= totalW;
        finalAway /= totalW;
      }
    } 
    else if (this.config.level === 'stacking') {
        const metaWeights = this.config.metaLearnerWeights || {};
        let logitHome = 0, logitDraw = 0, logitAway = 0;
        
        for (const { id } of models) {
            const wH = metaWeights[`${id}_home`] ?? 1.0;
            const wD = metaWeights[`${id}_draw`] ?? 1.0;
            const wA = metaWeights[`${id}_away`] ?? 1.0;
            
            const p = individualPredictions[id];
            // Simple logit transformation sum
            logitHome += Math.log(p.pHome / (1 - p.pHome)) * wH;
            logitDraw += Math.log(p.pDraw / (1 - p.pDraw)) * wD;
            logitAway += Math.log(p.pAway / (1 - p.pAway)) * wA;
        }
        
        const expH = Math.exp(logitHome);
        const expD = Math.exp(logitDraw);
        const expA = Math.exp(logitAway);
        const sumExp = expH + expD + expA;
        
        finalHome = expH / sumExp;
        finalDraw = expD / sumExp;
        finalAway = expA / sumExp;
    }
    else if (this.config.level === 'bayesian_average') {
       // Simplified Bayesian Model Averaging
       const weights = this.config.weights || {};
       let totalW = 0;
       for (const { id } of models) {
         // Weights here represent model posterior probabilities P(M|D)
         const w = weights[id] ?? (1.0 / models.length);
         const p = individualPredictions[id];
         finalHome += p.pHome * w;
         finalDraw += p.pDraw * w;
         finalAway += p.pAway * w;
         totalW += w;
       }
       if (totalW > 0) {
         finalHome /= totalW;
         finalDraw /= totalW;
         finalAway /= totalW;
       }
    }

    // Normalize safely
    const sum = finalHome + finalDraw + finalAway;
    finalHome /= sum;
    finalDraw /= sum;
    finalAway /= sum;

    // Apply Calibration Routing
    const leagueId = context?.leagueId || 'unknown';
    const marketType = context?.marketType || 'ML';
    // Using Ensemble_v1 as a placeholder model version for the routing key
    const routingKey = CalibrationRouter.generateKey('Ensemble_v1', leagueId, marketType);
    
    const calibrated = calibrationRouter.calibrate(routingKey, [finalHome, finalDraw, finalAway]);
    
    finalHome = calibrated.probabilities[0];
    finalDraw = calibrated.probabilities[1];
    finalAway = calibrated.probabilities[2];
    const uncertaintyScore = calibrated.uncertaintyScore;

    return {
      pHome: Number(finalHome.toFixed(4)),
      pDraw: Number(finalDraw.toFixed(4)),
      pAway: Number(finalAway.toFixed(4)),
      modelConfidence: Number((100 * (1 - uncertaintyScore)).toFixed(1)),
      disagreementScore: this.calculateDisagreement(predictionsList),
      individualPredictions
    };
  }
}
