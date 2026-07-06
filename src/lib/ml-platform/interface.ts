// HandicapLab ML Platform - Unified Interface
export interface ModelMetadata {
  modelId: string;
  version: string;
  algorithm: string;
  datasetVersion: string;
  featureVersion: string;
  registryVersion: string;
  calibrationVersion: string;
  benchmarkVersion: string;
  randomSeed: number;
  gitCommit: string;
  hyperparameters: Record<string, any>;
  trainingDate: string;
  metrics: Record<string, number>;
  status: 'Experimental' | 'Candidate' | 'Shadow' | 'Production' | 'Deprecated';
  owner: string;
  fingerprint: string;
}

export interface PredictionResult {
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface MachineLearningModel {
  /**
   * Train the model on a provided dataset.
   */
  train(features: any[], targets: any[]): Promise<void>;

  /**
   * Predict the outcome classes.
   */
  predict(features: any): Promise<number>;

  /**
   * Output raw probabilities for outcomes.
   */
  predictProbability(features: any): Promise<PredictionResult>;

  /**
   * Post-processing calibration mechanism.
   */
  calibrate(validationFeatures: any[], validationTargets: any[]): Promise<void>;

  /**
   * Serialize and save model artifacts.
   */
  save(directoryPath: string): Promise<void>;

  /**
   * Load model artifacts from disk, enabling inference without training pipeline.
   */
  load(directoryPath: string): Promise<void>;

  /**
   * Explain predictions (e.g. SHAP, Permutation).
   */
  explain(features: any): Promise<any>;

  /**
   * Access the exact versioning contract.
   */
  metadata(): ModelMetadata;
}
