import { supabase } from '@/lib/supabase.server';

export interface TrainingJobModel {
  id?: number;
  jobId: string;
  datasetVersion: string;
  featureSet: string[];
  algorithm: string;
  seed: number;
  hyperparameters: Record<string, any>;
  durationMs?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  modelTier?: 'champion' | 'candidate' | 'shadow' | 'retired';
}

export interface ModelComparisonModel {
  jobId: string;
  brierScore: number;
  logLoss: number;
  yieldPct: number;
  sharpe: number;
  maxDrawdown: number;
  calibrationError: number;
}

export class TimeSeriesSplitEngine {
  /**
   * Performs Walk Forward time series splitting.
   */
  public static walkForwardSplit<T>(items: T[], trainRatio = 0.7): { train: T[]; validation: T[] } {
    const splitIndex = Math.floor(items.length * trainRatio);
    return {
      train: items.slice(0, splitIndex),
      validation: items.slice(splitIndex)
    };
  }

  /**
   * Performs Rolling Window time series splitting.
   */
  public static rollingWindowSplit<T>(items: T[], windowSize: number, stepIndex: number): { train: T[]; validation: T[] } {
    const start = stepIndex;
    const end = start + windowSize;
    if (end >= items.length) {
      return { train: items.slice(start), validation: [] };
    }
    return {
      train: items.slice(start, end),
      validation: items.slice(end, end + Math.floor(windowSize * 0.3))
    };
  }
}

export class CalibrationEngine {
  /**
   * Applies basic Platt Scaling calibration constants.
   * P(y=1|x) = 1 / (1 + exp(A * x + B))
   */
  public static plattScale(probability: number, A = -1.0, B = 0.0): number {
    // Log-odds transformation
    const logOdds = Math.log(probability / (1 - probability));
    const calibratedOdds = A * logOdds + B;
    return 1 / (1 + Math.exp(calibratedOdds));
  }

  /**
   * Computes Brier Score to measure probability calibration accuracy.
   */
  public static computeBrierScore(predictions: number[], outcomes: number[]): number {
    if (predictions.length === 0 || predictions.length !== outcomes.length) return 0.0;
    
    let sum = 0;
    for (let i = 0; i < predictions.length; i++) {
      sum += Math.pow(predictions[i] - outcomes[i], 2);
    }
    return Number((sum / predictions.length).toFixed(4));
  }
}

export class MLTrainingService {
  /**
   * Registers a hyperparameter job configuration.
   */
  public async registerJob(model: TrainingJobModel): Promise<TrainingJobModel> {
    const payload = {
      job_id: model.jobId,
      dataset_version: model.datasetVersion,
      feature_set: model.featureSet,
      algorithm: model.algorithm,
      seed: model.seed,
      hyperparameters: model.hyperparameters,
      duration_ms: model.durationMs || 0,
      status: model.status || 'pending',
      model_tier: model.modelTier || 'challenger',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('wh_ml_training_jobs')
      .upsert(payload, { onConflict: 'job_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[MLTrainingService] Job register failed: ${error.message}`);
    }

    return {
      id: Number(data.id),
      jobId: data.job_id,
      datasetVersion: data.dataset_version,
      featureSet: data.feature_set,
      algorithm: data.algorithm,
      seed: data.seed,
      hyperparameters: data.hyperparameters,
      durationMs: data.duration_ms,
      status: data.status,
      modelTier: data.model_tier
    };
  }

  /**
   * Updates champion challenger status of model tier logs.
   */
  public async promoteModel(jobId: string, newTier: TrainingJobModel['modelTier']): Promise<void> {
    const { error } = await supabase
      .from('wh_ml_training_jobs')
      .update({ model_tier: newTier, updated_at: new Date().toISOString() })
      .eq('job_id', jobId);

    if (error) {
      throw new Error(`[MLTrainingService] Model promotion failed: ${error.message}`);
    }
  }
}
