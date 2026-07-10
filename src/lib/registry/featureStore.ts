/**
 * HandicapLab Feature Store
 * ===========================
 * Versioned registry for all prediction features.
 *
 * Every feature has:
 *   - Unique ID and semantic version
 *   - Formula / derivation logic description
 *   - Dependencies on other features
 *   - Lifecycle status
 *
 * No feature is ever deleted — only deprecated.
 *
 * Hardening: standardized IDs, metadata contract, domain events.
 */

import { generateId, ID_PREFIX } from './identifiers';
import { createBaseMetadata } from './metadata';
import { createEvent, RegistryEvent, RegistryEventType } from './events';

export type FeatureType = 'raw' | 'derived' | 'composite' | 'external';
export type FeatureStatus = 'active' | 'experimental' | 'deprecated';

export interface FeatureDefinition {
  id: string;
  name: string;
  version: string;
  type: FeatureType;
  status: FeatureStatus;
  description: string;
  formula: string;
  owner: string;
  dependencies: string[];
  tags: string[];
  events: RegistryEvent[];
  createdAt: string;
  deprecatedAt?: string;
}

export class FeatureStore {
  private features: Map<string, FeatureDefinition> = new Map();
  private versionIndex: Map<string, string[]> = new Map();

  register(name: string, version: string, type: FeatureType, description: string, formula: string, owner: string, dependencies: string[] = [], tags: string[] = []): FeatureDefinition {
    const id = generateId(ID_PREFIX.FEATURE);

    const feature: FeatureDefinition = {
      id,
      name,
      version,
      type,
      status: 'active' as FeatureStatus,
      description,
      formula,
      owner,
      dependencies,
      tags,
      events: [],
      createdAt: new Date().toISOString(),
    };

    feature.events.push(createEvent('FeatureRegistered' as RegistryEventType, id, 'feature', { name, version, type }));
    this.features.set(id, feature);
    if (!this.versionIndex.has(name)) {
      this.versionIndex.set(name, []);
    }
    this.versionIndex.get(name)!.push(version);
    return feature;
  }

  get(id: string): FeatureDefinition | undefined {
    return this.features.get(id);
  }

  getByName(name: string): FeatureDefinition[] {
    // Search by name field (standardized) or fall back to versionIndex
    const all = this.getAll().filter((f) => f.name === name);
    if (all.length > 0) return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // Fallback to old version index
    const versions = this.versionIndex.get(name) || [];
    return versions
      .map((v) => Array.from(this.features.values()).find((f) => f.name === name && f.version === v))
      .filter((f): f is FeatureDefinition => f !== undefined)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getLatest(name: string): FeatureDefinition | undefined {
    const versions = this.getByName(name);
    return versions.length > 0 ? versions[0] : undefined;
  }

  getAll(): FeatureDefinition[] {
    return Array.from(this.features.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getByType(type: FeatureType): FeatureDefinition[] {
    return this.getAll().filter((f) => f.type === type);
  }

  getActive(): FeatureDefinition[] {
    return this.getAll().filter((f) => f.status === 'active');
  }

  deprecate(id: string): FeatureDefinition {
    const feature = this.features.get(id);
    if (!feature) throw new Error(`Feature ${id} not found`);
    feature.status = 'deprecated' as FeatureStatus;
    feature.deprecatedAt = new Date().toISOString();
    feature.events.push(createEvent('FeatureDeprecated' as RegistryEventType, id, 'feature', { deprecatedAt: feature.deprecatedAt }));
    return feature;
  }

  getDependents(featureId: string): FeatureDefinition[] {
    return this.getAll().filter((f) => f.dependencies.includes(featureId));
  }

  getDependencyChain(featureId: string): string[] {
    const visited = new Set<string>();
    const chain: string[] = [];
    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const feature = this.features.get(id);
      if (feature) {
        chain.push(id);
        for (const dep of feature.dependencies) {
          traverse(dep);
        }
      }
    };
    traverse(featureId);
    return chain;
  }

  getStatistics(): { total: number; active: number; experimental: number; deprecated: number; raw: number; derived: number } {
    const all = this.getAll();
    return {
      total: all.length,
      active: all.filter((f) => f.status === 'active').length,
      experimental: all.filter((f) => f.status === 'experimental').length,
      deprecated: all.filter((f) => f.status === 'deprecated').length,
      raw: all.filter((f) => f.type === 'raw').length,
      derived: all.filter((f) => f.type === 'derived' || f.type === 'composite').length,
    };
  }

  registerDefaults(): void {
    const features: Array<[string, string, FeatureType, string, string]> = [
      ['poisson-attack', '1.0.0', 'raw', 'Poisson attack strength for home team', 'homeGoalsScored / matchesPlayed'],
      ['poisson-defense', '1.0.0', 'raw', 'Poisson defense strength for home team', 'homeGoalsConceded / matchesPlayed'],
      ['elo-rating', '1.0.0', 'raw', 'ELO rating for each team', 'K * (actual - expected)'],
      ['rest-days', '1.0.0', 'raw', 'Days since last match', 'currentDate - lastMatchDate'],
      ['travel-distance', '1.0.0', 'raw', 'Travel distance in km', 'distance between venues'],
      ['home-advantage', '1.0.0', 'raw', 'Home advantage modifier', 'historical home win rate - 0.5'],
      ['market-drift', '1.0.0', 'raw', 'Market odds movement percentage', '(closingOdds - openingOdds) / openingOdds'],
      ['injuries-impact', '1.0.0', 'raw', 'Injury impact score', 'sum of key player absence weights'],
    ];
    for (const [name, version, type, description, formula] of features) {
      try { this.register(name, version, type, description, formula, 'system'); } catch { /* skip duplicates */ }
    }

    const derived: Array<[string, string, FeatureType, string, string[]]> = [
      ['expected-goals', '1.0.0', 'derived', 'Expected goals for a match', []],
      ['elo-delta', '1.0.0', 'derived', 'ELO rating difference', []],
      ['recent-form', '1.0.0', 'derived', 'Weighted recent form score', []],
      ['rolling-goals', '1.0.0', 'derived', 'Rolling average goals scored', []],
      ['closing-odds-drift', '1.0.0', 'derived', 'Closing odds movement from opening', []],
      ['away-fatigue', '1.0.0', 'derived', 'Away team fatigue modifier', []],
      ['weighted-edge', '1.0.0', 'composite', 'Final edge after all adjustments', []],
    ];
    for (const [name, version, type, description] of derived) {
      try { this.register(name, version, type, description, '', 'system'); } catch { /* skip duplicates */ }
    }
  }
}

export const featureStore = new FeatureStore();