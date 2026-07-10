/**
 * HandicapLab Experiment Artifacts
 * ==================================
 * Contract for experiment outputs and results.
 *
 * Every completed experiment produces an ExperimentArtifact that bundles
 * the configuration snapshot, validation results, benchmark output,
 * human-readable report, summary metrics, and execution logs.
 */

export interface ExperimentArtifact {
  /** The experiment this artifact belongs to. */
  experimentId: string;
 
  /** Snapshot of the experiment configuration at start time. */
  config: Record<string, unknown>;
 
  /** Validation metrics and results. */
  validation: Record<string, unknown>;
 
  /** Benchmark results against challenger models or baselines. */
  benchmark: Record<string, unknown>;
 
  /** Human-readable report in markdown format. */
  report: string;
 
  /** Key-value summary of the most important results. */
  summary: Record<string, unknown>;
 
  /** Ordered log lines from the experiment execution. */
  logs: string[];
 
  /** ISO timestamp when this artifact was created. */
  createdAt: string;
}

/**
 * Create a minimal ExperimentArtifact with sensible defaults.
 */
export function createArtifact(
  experimentId: string,
  overrides: Partial<Omit<ExperimentArtifact, 'experimentId'>> = {}
): ExperimentArtifact {
  return {
    experimentId,
    config: overrides.config || {},
    validation: overrides.validation || {},
    benchmark: overrides.benchmark || {},
    report: overrides.report || '',
    summary: overrides.summary || {},
    logs: overrides.logs || [],
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}
