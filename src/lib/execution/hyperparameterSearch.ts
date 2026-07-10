import { ExperimentRegistry, ExperimentConfig } from '../registry/experimentRegistry';
import { ModelRegistry } from '../registry/modelRegistry';
import { BenchmarkRegistry } from './benchmarkRegistry';
import { ExperimentExecutor } from './experimentExecutor';
import { CanonicalDataset } from '../dataset/types';
import { HistoricalDataProvider } from '../replay/providers';

export interface SearchSpace {
  poissonWeight?: number[];
  dcWeight?: number[];
  kellyMultiplier?: number[];
  homeAdvantageModifier?: number[];
}

export interface SearchResult {
  parameters: Record<string, number>;
  experimentId: string;
  roi: number;
  brierScore: number;
}

export class HyperparameterSearch {
  constructor(
    private readonly executor: ExperimentExecutor,
    private readonly modelRegistry: ModelRegistry,
    private readonly modelId: string,
    private readonly dataset: CanonicalDataset,
    private readonly dataProvider: HistoricalDataProvider,
  ) {}
  async gridSearch(space: SearchSpace, researcher: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const keys = Object.keys(space) as (keyof SearchSpace)[];
    const runFromConfig = async (params: Record<string, number>): Promise<SearchResult> => {
      const co: Partial<ExperimentConfig> = { parameters: params };
      const r = await this.executor.runExperiment(
        'Hyperparameter: ' + JSON.stringify(params), 'Grid search', researcher,
        this.modelId, this.dataset, co);
      return {parameters: params, experimentId: r.experiment.id, roi: r.validation.roi, brierScore: r.validation.brierScore};
    };
    for (const key of keys) {
      for (const val of space[key] || []) {
        const params: Record<string, number> = {};
        params[key === 'poissonWeight' ? 'poisson' : key === 'dcWeight' ? 'dc' : key] = val;
        results.push(await runFromConfig(params));
      }
    }
    return results.sort((a, b) => b.roi - a.roi);
  }
}
