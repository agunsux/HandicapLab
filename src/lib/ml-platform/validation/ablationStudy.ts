import { MachineLearningModel } from '../interface';
import { CrossValidator, CrossValidationResult } from './crossValidator';

export type FeatureBundle = 'Market' | 'xG' | 'Squad' | 'Referee' | 'All';

export interface AblationResult {
  removedBundle: FeatureBundle | 'None';
  metrics: CrossValidationResult['overallMetrics'];
  dropInROI: number;
  dropInLogLoss: number; // positive means logloss got worse (higher)
  isStatisticallySignificant: boolean;
}

export interface AblationReport {
  baseline: AblationResult;
  ablations: AblationResult[];
}

/**
 * AblationStudy
 * Evaluates the impact of removing specific feature bundles on model performance.
 */
export class AblationStudy {
  constructor(private validator: CrossValidator) {}

  /**
   * Run the ablation study by systematically removing feature bundles.
   * This is a stub for the full implementation that would train the model
   * multiple times and run statistical significance tests (e.g. paired bootstrap).
   */
  async run(
    modelFactory: () => MachineLearningModel, 
    dataset: any[], 
    bundlesToTest: FeatureBundle[]
  ): Promise<AblationReport> {
    
    // 1. Run Baseline (All features)
    // const baselineMetrics = await this.evaluateModel(modelFactory(), dataset);
    
    const baselineResult: AblationResult = {
      removedBundle: 'None',
      metrics: { meanROI: 5.2, stdROI: 1.1, meanLogLoss: 0.612, stdLogLoss: 0.01, meanBrier: 0.201, stdBrier: 0.005 },
      dropInROI: 0,
      dropInLogLoss: 0,
      isStatisticallySignificant: false
    };

    const ablations: AblationResult[] = [];

    // 2. Loop through bundles and remove them
    for (const bundle of bundlesToTest) {
      // In real implementation: datasetWithoutBundle = removeFeatures(dataset, bundle)
      // metrics = await this.evaluateModel(modelFactory(), datasetWithoutBundle);
      // const dropInROI = baselineMetrics.meanROI - metrics.meanROI;
      // const isStatisticallySignificant = runPairedBootstrap(baselinePredictions, ablatedPredictions);
      
      ablations.push({
        removedBundle: bundle,
        metrics: { meanROI: 3.1, stdROI: 1.5, meanLogLoss: 0.625, stdLogLoss: 0.012, meanBrier: 0.205, stdBrier: 0.006 },
        dropInROI: 2.1, // mock
        dropInLogLoss: 0.013, // mock
        isStatisticallySignificant: true
      });
    }

    return {
      baseline: baselineResult,
      ablations
    };
  }
}
