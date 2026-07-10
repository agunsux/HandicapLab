import crypto from 'crypto';
import { ExperimentRegistry, ExperimentConfig } from '../registry/experimentRegistry';
import { ModelRegistry } from '../registry/modelRegistry';
import { ExecutionPipeline } from './pipeline';
import { CanonicalDataset } from '../dataset/types';
import { HistoricalDataProvider } from '../replay/providers';
import { BenchmarkRegistry } from './benchmarkRegistry';
import { ModelComparisonEngine } from './modelComparison';
import { ExperimentResult, BenchmarkResult } from './types';
import { generateId, ID_PREFIX } from '../registry/identifiers';

export class ExperimentExecutor {
  constructor(
    private readonly experimentRegistry: ExperimentRegistry,
    private readonly modelRegistry: ModelRegistry,
    private readonly benchmarkRegistry: BenchmarkRegistry,
    private readonly comparisonEngine: ModelComparisonEngine,
    private readonly dataProvider: HistoricalDataProvider,
  ) {}
  async runExperiment(
    objective: string, hypothesis: string, researcher: string,
    modelId: string, dataset: CanonicalDataset,
    configOverrides?: Partial<ExperimentConfig>,
  ): Promise<ExperimentResult> {
    const config: ExperimentConfig = {
      datasetVersion: dataset.manifest.version,
      datasetHash: dataset.manifest.hash,
      replaySeed: Math.floor(Math.random() * 10000),
      featureSetVersion: '1.0',
      modelVersion: this.modelRegistry.get(modelId)?.semanticVersion || '1.0.0',
      configurationHash: generateId('cfg'),
      engineVersion: '1.0.0',
      parameters: configOverrides?.parameters || {},
    };
    const exp = this.experimentRegistry.create(objective, hypothesis, researcher, config);
    const pipeline = new ExecutionPipeline(this.experimentRegistry, this.modelRegistry, this.dataProvider);
    const result = await pipeline.run({
      experimentId: exp.id, dataset, modelId,
      maxMatches: configOverrides?.parameters?.maxMatches || undefined,
      replaySeed: config.replaySeed,
    });
    const champion = this.modelRegistry.getChampion();
    if (champion && champion.id !== modelId) {
      const model = this.modelRegistry.get(modelId);
      if (model?.validationMetrics && champion.validationMetrics) {
        const br: BenchmarkResult = {
          opponentId: champion.id, opponentName: champion.name,
          ourMetrics: model.validationMetrics,
          opponentMetrics: champion.validationMetrics,
          deltas: {
            roi: model.validationMetrics.roi - champion.validationMetrics.roi,
            brierScore: champion.validationMetrics.brierScore - model.validationMetrics.brierScore,
            ece: champion.validationMetrics.ece - model.validationMetrics.ece,
          },
          recommendation: model.validationMetrics.roi > champion.validationMetrics.roi ? 'promote' : 'hold',
          timestamp: new Date().toISOString(),
        };
        this.benchmarkRegistry.record(exp.id, modelId, model.name, model.semanticVersion,
          dataset.manifest.hash, dataset.manifest.version, br);
        this.modelRegistry.addBenchmark(modelId, champion.validationMetrics, champion.name);
      }
    }
    return result;
  }
}
