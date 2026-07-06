// HandicapLab Feature Platform - Feature Store API
import { FeatureRegistry, featureRegistry } from './registry';
import * as fs from 'fs';
import * as path from 'path';

export interface FeatureVector {
  matchId: string;
  timestamp: string;
  features: Record<string, number | string | boolean | null>;
}

export class FeatureStore {
  private registry: FeatureRegistry;
  private computedSnapshots: Map<string, FeatureVector> = new Map();

  constructor(registry: FeatureRegistry) {
    this.registry = registry;
  }

  /**
   * Retrieves a single feature's value for a given match.
   */
  public async getFeature(matchId: string, featureId: string): Promise<any> {
    const snapshot = await this.getSnapshot(matchId);
    if (!(featureId in snapshot.features)) {
      throw new Error(`Feature ${featureId} not found in snapshot for match ${matchId}`);
    }
    return snapshot.features[featureId];
  }

  /**
   * Retrieves the full feature vector for a given match.
   */
  public async getFeatureVector(matchId: string): Promise<FeatureVector> {
    return this.getSnapshot(matchId);
  }

  /**
   * Retrieves the snapshot, computing it if necessary (mocked for now).
   */
  public async getSnapshot(matchId: string): Promise<FeatureVector> {
    if (this.computedSnapshots.has(matchId)) {
      return this.computedSnapshots.get(matchId)!;
    }

    // In a real scenario, this would orchestrate calculators based on DAG order
    const orderedFeatures = this.registry.resolveDAG();
    const vector: Record<string, any> = {};

    for (const featId of orderedFeatures) {
       const def = this.registry.getFeature(featId);
       // Mock computation: fill with default value or zero
       vector[featId] = def.defaultValue !== undefined ? def.defaultValue : 0;
    }

    const snapshot: FeatureVector = {
      matchId,
      timestamp: new Date().toISOString(),
      features: vector
    };

    this.computedSnapshots.set(matchId, snapshot);
    return snapshot;
  }

  /**
   * Get the history of snapshots for a team (mocked).
   */
  public async getHistory(teamId: string): Promise<FeatureVector[]> {
    // Return all snapshots (placeholder)
    return Array.from(this.computedSnapshots.values());
  }

  /**
   * Returns the underlying registry.
   */
  public getRegistry(): FeatureRegistry {
    return this.registry;
  }

  /**
   * Validate a feature exists in the registry.
   */
  public validateFeature(featureId: string): boolean {
    try {
      this.registry.getFeature(featureId);
      return true;
    } catch {
      return false;
    }
  }
}

export const featureStore = new FeatureStore(featureRegistry);
