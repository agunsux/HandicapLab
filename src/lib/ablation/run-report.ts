import { AblationRunner } from './runner';
import { ComparisonMatrix } from './comparison-matrix';
import { ExperimentConfig } from './types';

async function runReport() {
  console.log('🧪 Running Sprints 5 Ablation Experiment Report...\n');

  const config: ExperimentConfig = {
    name: 'Quant Edge Engine v1 - Model Comparison',
    baseline: {
      modelVersion: 'prematch-v1', // standard ensembled calibrated Dixon-Coles model
      featureVersion: 'basic-v1'
    },
    variants: [
      {
        name: 'Poisson Model (Uncalibrated)',
        modelVersion: 'poisson-v1',
        featureVersion: 'basic-v1'
      },
      {
        name: 'Dixon-Coles Model (Uncalibrated)',
        modelVersion: 'dixon-coles-v1',
        featureVersion: 'basic-v1'
      }
    ],
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
      end: new Date()
    },
    markets: ['ML', 'AH', 'OU']
  };

  try {
    const { baseline, variants } = await AblationRunner.runExperiment(config);
    const allResults = [baseline, ...variants];
    
    const markdownTable = ComparisonMatrix.generate(allResults);
    
    console.log('📊 Comparative Ablation Matrix:');
    console.log(markdownTable);

    console.log('✅ Ablation experiment complete!');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to execute ablation run:', message);
  }
}

runReport().catch(err => {
  console.error('Fatal error running ablation report:', err);
});
