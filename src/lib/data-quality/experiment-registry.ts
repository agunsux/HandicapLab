// EPIC 39 — Experiment Registry Engine
// Tracks all research experiments, model variations, features tested, ROI delta, and approval status.

export interface ExperimentRecord {
  experimentId: string;
  modelType: string;
  featuresTested: string[];
  roiDeltaPct: number;
  clvDeltaPct: number;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  notes: string;
  createdAt: string;
}

export class ExperimentRegistryEngine {
  private static EXPERIMENTS: ExperimentRecord[] = [
    {
      experimentId: 'EXP-2026-041',
      modelType: 'Poisson + ELO',
      featuresTested: ['Travel Days', 'Rest Differential', 'PPDA Ratio'],
      roiDeltaPct: 1.8,
      clvDeltaPct: 0.9,
      status: 'ACCEPTED',
      notes: 'Added travel distance decay function. Realized ROI improved by +1.8% in backtest.',
      createdAt: '2026-07-20T10:00:00Z',
    },
    {
      experimentId: 'EXP-2026-040',
      modelType: 'XGBoost Baseline',
      featuresTested: ['Raw Weather Wind Speed'],
      roiDeltaPct: -0.4,
      clvDeltaPct: -0.2,
      status: 'REJECTED',
      notes: 'Wind speed feature introduced noise. Backtest ROI degraded by -0.4%. Rejected.',
      createdAt: '2026-07-18T14:30:00Z',
    },
  ];

  /** Get registered research experiments */
  static getExperiments(): ExperimentRecord[] {
    return this.EXPERIMENTS;
  }

  /** Register new experiment log */
  static registerExperiment(exp: Omit<ExperimentRecord, 'createdAt'>): ExperimentRecord {
    const record: ExperimentRecord = {
      ...exp,
      createdAt: new Date().toISOString(),
    };
    this.EXPERIMENTS.unshift(record);
    return record;
  }
}
