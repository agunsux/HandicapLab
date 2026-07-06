export interface ComplexityReport {
  featureCount: number;
  trainingTimeMs: number;
  modelSizeBytes: number;
  inferenceLatencyMs: number;
  peakRamUsageMB: number;
}

export class ComplexityAnalyzer {
  analyze(model: any, trainingStats: any): ComplexityReport {
    return {
      featureCount: model.metadata?.features?.length || 0,
      trainingTimeMs: trainingStats.durationMs || 0,
      modelSizeBytes: 2500000, // mock 2.5MB
      inferenceLatencyMs: 1.2, // mock 1.2ms per row
      peakRamUsageMB: 120 // mock 120MB
    };
  }
}
