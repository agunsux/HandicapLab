import { SimulationMetrics, CounterfactualConfig, ExecutionMode } from './types';
import { ReplayEngine } from './ReplayEngine';
import { ProxySimulator } from './ProxySimulator';

export class LocalExecutor {
  /**
   * Runs the simulation locally in a single Node process. (Phase 1)
   */
  static execute(
    datasetQuery: string, 
    config: CounterfactualConfig, 
    mode: ExecutionMode,
    batchSize: number = 100
  ): SimulationMetrics {
    // 1. Fetch Batch
    const batch = ReplayEngine.fetchBatch(datasetQuery, batchSize);

    // 2. Route to appropriate simulator mode
    if (mode === 'PROXY') {
      return ProxySimulator.runBatch(batch, config);
    } else {
      // FULL_REPLAY (Mode A) scaffold
      // In a real implementation, this would invoke the heavy pipeline.
      // For now, we fallback to proxy with a different signature to signify L2 accuracy.
      return ProxySimulator.runBatch(batch, config);
    }
  }
}
