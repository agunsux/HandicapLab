import { SilverMergeEngine } from '../engine/silver-merge-engine';
import { FeatureStore } from '../engine/feature-store';
import { LeakageDetector } from '../engine/leakage-detector';
import { GoldDatasetBuilder } from '../engine/gold-dataset-builder';
import { DatasetValidator } from '../engine/dataset-validator';
import { WalkForwardSplitter } from '../engine/walk-forward-splitter';
import { ResearchBaselines } from '../engine/research-baselines';

async function main() {
  console.log('--- Starting EPIC 32 Research Data Pipeline ---');

  // We are targeting EPL 2015-2024
  const seasons = [
    '2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020',
    '2020-2021', '2021-2022', '2022-2023', '2023-2024'
  ];

  const mergeEngine = new SilverMergeEngine();
  const featureStore = new FeatureStore();
  
  let allFixtures: any[] = [];

  for (const season of seasons) {
    console.log(`Processing Silver Merge for ${season}...`);
    const fixtures = mergeEngine.runMerge(season);
    if (fixtures.length > 0) {
      mergeEngine.saveSilver(season, fixtures);
      featureStore.loadFixtures(fixtures);
      allFixtures = [...allFixtures, ...fixtures];
    }
  }

  console.log('Generating Feature Store...');
  const features = featureStore.generateFeatures();
  featureStore.saveFeatures(features);

  console.log('Validating Leakage...');
  const leakageDetector = new LeakageDetector();
  leakageDetector.validate(allFixtures, features);
  console.log('Leakage validation passed (Zero Future Leakage).');

  console.log('Validating Dataset Integrity...');
  const validator = new DatasetValidator();
  validator.validate(allFixtures, features);

  console.log('Building Gold Datasets...');
  const goldBuilder = new GoldDatasetBuilder();
  goldBuilder.build(allFixtures, features);

  console.log('Generating Walk-Forward Splits...');
  const splitter = new WalkForwardSplitter();
  const folds = splitter.generateSplits(seasons);

  console.log('Evaluating Research Baselines...');
  const baselines = new ResearchBaselines();
  baselines.evaluate(folds);

  console.log('--- Pipeline Completed Successfully ---');
}

main().catch(e => {
  console.error("Pipeline failed:", e);
  process.exit(1);
});
