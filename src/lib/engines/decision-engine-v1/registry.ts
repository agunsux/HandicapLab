// HandicapLab Decision Engine v1 - Model Registry & Interfaces
// Location: src/lib/engines/decision-engine-v1/registry.ts

import { PredictionModel } from './models/predictionModel';

export class ModelRegistry {
  private static models: Map<string, PredictionModel> = new Map();

  /**
   * Registers a prediction model to the ensemble registry.
   */
  public static register(id: string, model: PredictionModel): void {
    this.models.set(id, model);
  }

  /**
   * Unregisters a prediction model from the ensemble registry.
   */
  public static unregister(id: string): void {
    this.models.delete(id);
  }

  /**
   * Returns a model by ID.
   */
  public static getModel(id: string): PredictionModel | undefined {
    return this.models.get(id);
  }

  /**
   * Returns all currently registered models and their IDs.
   */
  public static getModels(): { id: string, model: PredictionModel }[] {
    return Array.from(this.models.entries()).map(([id, model]) => ({ id, model }));
  }

  /**
   * Clears the registry.
   */
  public static clear(): void {
    this.models.clear();
  }
}
