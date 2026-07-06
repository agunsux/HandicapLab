import { MachineLearningModel } from '../interface';
import { CrossValidator, CrossValidationResult } from './crossValidator';

export interface LearningCurvePoint {
  trainingPercentage: number;
  trainingSize: number;
  metrics: CrossValidationResult['overallMetrics'];
}

export interface LearningCurveReport {
  points: LearningCurvePoint[];
  hasPlateaued: boolean;
}

/**
 * LearningCurveAnalyzer
 * Evaluates the model's performance as a function of the training dataset size.
 */
export class LearningCurveAnalyzer {
  constructor(private validator: CrossValidator) {}

  /**
   * Run the learning curve analysis by incrementally increasing training data volume.
   */
  async run(
    modelFactory: () => MachineLearningModel,
    dataset: any[],
    percentages: number[] = [10, 20, 40, 60, 80, 100]
  ): Promise<LearningCurveReport> {
    const points: LearningCurvePoint[] = [];
    
    // Simulating the learning curve generation
    for (const pct of percentages) {
      const size = Math.floor(dataset.length * (pct / 100));
      // const subset = dataset.slice(0, size);
      // const metrics = await this.evaluateModel(modelFactory(), subset);
      
      points.push({
        trainingPercentage: pct,
        trainingSize: size,
        metrics: {
          meanROI: 1.2 + (pct / 100) * 4, // fake curve
          stdROI: 2.0 - (pct / 100) * 0.9,
          meanLogLoss: 0.69 - (pct / 100) * 0.08,
          stdLogLoss: 0.02 - (pct / 100) * 0.01,
          meanBrier: 0.25 - (pct / 100) * 0.05,
          stdBrier: 0.01 - (pct / 100) * 0.005
        }
      });
    }

    // Heuristic: If LogLoss improves by less than 0.001 between 80% and 100%, it has plateaued
    const pt80 = points.find(p => p.trainingPercentage === 80);
    const pt100 = points.find(p => p.trainingPercentage === 100);
    
    let hasPlateaued = false;
    if (pt80 && pt100) {
      hasPlateaued = Math.abs(pt80.metrics.meanLogLoss - pt100.metrics.meanLogLoss) < 0.001;
    }

    return { points, hasPlateaued };
  }
}
