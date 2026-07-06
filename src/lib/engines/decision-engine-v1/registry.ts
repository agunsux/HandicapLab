// HandicapLab Decision Engine v1 - Model Registry & Interfaces
// Location: src/lib/engines/decision-engine-v1/registry.ts

import { MatchFeatures } from '../feature-engine/types';

export interface ModelPrediction {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  confidence: number; // 0 to 100
  modelName: string;
  version: string;
}

export interface EnsembleSubModel {
  id: string;
  name: string;
  predict(features: MatchFeatures): Promise<ModelPrediction>;
}

export class ModelRegistry {
  private static models: Map<string, EnsembleSubModel> = new Map();

  /**
   * Registers a prediction model to the ensemble registry.
   */
  public static register(id: string, model: EnsembleSubModel): void {
    this.models.set(id, model);
  }

  /**
   * Unregisters a prediction model from the ensemble registry.
   */
  public static unregister(id: string): void {
    this.models.delete(id);
  }

  /**
   * Returns all currently registered models.
   */
  public static getModels(): EnsembleSubModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Clears the registry.
   */
  public static clear(): void {
    this.models.clear();
  }
}
