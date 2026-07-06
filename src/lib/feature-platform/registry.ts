// HandicapLab Feature Platform - Registry
import * as fs from 'fs';
import * as path from 'path';

export type FeatureCategory = 
  | 'Team Strength' | 'Squad' | 'Tactical' | 'Schedule' | 'Travel' 
  | 'Referee' | 'Weather' | 'Market' | 'xG' | 'Form' 
  | 'Player' | 'Venue' | 'Psychological' | 'Competition' 
  | 'Betting Market' | 'Derived Features';

export type LeakageClassification = 'Safe' | 'Warning' | 'Unsafe';

export interface FeatureDefinition {
  id: string;
  name: string;
  category: FeatureCategory;
  description: string;
  formula: string;
  unit: string;
  dataType: 'number' | 'boolean' | 'string' | 'categorical';
  nullable: boolean;
  defaultValue: any;
  source: string[];
  dependencies: string[];
  lookbackWindow: string; // e.g., '5 matches', '1 season', 'N/A'
  timeTravelPolicy: 'pre_match_only' | 'post_lineup' | 'live';
  updateFrequency: 'match' | 'daily' | 'weekly';
  version: string;
  formulaVersion: string;
  dependencyVersion: string;
  owner: string;
  qualityRules: {
    expectedMin?: number;
    expectedMax?: number;
    maxMissingRate: number;
  };
  validationRules: string[];
  minimumHistoryRequired: number;
  expectedRange: [number, number] | null;
  missingValueStrategy: 'impute_mean' | 'impute_zero' | 'drop' | 'forward_fill';
  driftThreshold: number; // PSI or JSD max acceptable threshold
  importance: number; // Initially 0, updated by importance history
  status: 'active' | 'deprecated' | 'experimental' | 'shadow' | 'quarantine';
  leakageClassification: LeakageClassification;
  leakageReasoning: string;
  lineage: string[]; // e.g. ['Event Feed', 'Shots', 'Match xG', 'Rolling xG']
}

export class FeatureRegistry {
  private features: Map<string, FeatureDefinition> = new Map();

  /**
   * Register a new feature definition.
   */
  public register(definition: FeatureDefinition): void {
    if (this.features.has(definition.id)) {
      throw new Error(`Feature with id ${definition.id} is already registered.`);
    }
    this.features.set(definition.id, definition);
  }

  /**
   * Retrieve a feature definition by ID.
   */
  public getFeature(id: string): FeatureDefinition {
    const feature = this.features.get(id);
    if (!feature) {
      throw new Error(`Feature with id ${id} not found.`);
    }
    return feature;
  }

  /**
   * Get all registered features.
   */
  public getAllFeatures(): FeatureDefinition[] {
    return Array.from(this.features.values());
  }

  /**
   * Validate that there are no circular dependencies (DAG resolution).
   * Returns topologically sorted feature IDs.
   */
  public resolveDAG(): string[] {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const order: string[] = [];
    const allIds = Array.from(this.features.keys());

    const dfs = (nodeId: string) => {
      if (recStack.has(nodeId)) {
        throw new Error(`Circular dependency detected involving feature: ${nodeId}`);
      }
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recStack.add(nodeId);

      const feature = this.features.get(nodeId);
      if (feature && feature.dependencies) {
        for (const dep of feature.dependencies) {
          if (!this.features.has(dep)) {
             throw new Error(`Feature ${nodeId} depends on unknown feature ${dep}`);
          }
          dfs(dep);
        }
      }

      recStack.delete(nodeId);
      order.push(nodeId);
    };

    for (const id of allIds) {
      if (!visited.has(id)) {
        dfs(id);
      }
    }

    return order;
  }

  /**
   * Get dependencies for a specific feature recursively.
   */
  public getLineageTree(id: string): string[] {
      // Simplified: Just returning direct dependencies and their dependencies
      const tree: string[] = [];
      const feature = this.getFeature(id);
      
      const explore = (depId: string) => {
          if (!tree.includes(depId)) {
              tree.push(depId);
              const depFeature = this.getFeature(depId);
              depFeature.dependencies.forEach(explore);
          }
      };

      feature.dependencies.forEach(explore);
      return tree;
  }
}

// Singleton instance
export const featureRegistry = new FeatureRegistry();
