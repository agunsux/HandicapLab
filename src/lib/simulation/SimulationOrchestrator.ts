import { 
  SimulationMetrics, 
  CounterfactualConfig, 
  ExecutorOptions 
} from './types';
import { LocalExecutor } from './LocalExecutor';

export class SimulationOrchestrator {
  /**
   * Routes the simulation request to the correct pluggable executor.
   */
  static runSimulation(
    datasetQuery: string, 
    config: CounterfactualConfig, 
    options: ExecutorOptions
  ): SimulationMetrics {
    
    // Phase 1: We only support LocalExecutor.
    // In Phase 2+, we would inspect `options.type` (e.g. WORKER, CLOUD)
    // and route accordingly.

    return LocalExecutor.execute(datasetQuery, config, options.mode, options.batchSize);
  }
}
