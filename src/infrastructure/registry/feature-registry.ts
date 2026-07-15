import type { Registry, ValidationResult } from '../../domain/registry';
import type { FeatureMetadata } from '../../domain/feature/types';

export class FeatureRegistry implements Registry<FeatureMetadata> {
  private registeredItems: Map<string, FeatureMetadata> = new Map();

  constructor() {
    // Pre-register standard HandicapLab features
    this.preRegisterFeatures();
  }

  private preRegisterFeatures(): void {
    const defaultFeatures: FeatureMetadata[] = [
      {
        featureId: "regime_type",
        featureName: "Structural Regime Label",
        featureFamily: "regime",
        description: "Classifies crowd attendance and temporal changes (VAR, closed doors, limited attendance)",
        dependencies: ["kickoff_time", "league"],
        owner: "handicaplab-core",
        version: "1.0.0",
        status: "active",
        createdAt: "2026-07-15T12:00:00Z",
        validationStatus: "Verified",
      },
      {
        featureId: "home_attack_strength",
        featureName: "Home Team Attack Rating",
        featureFamily: "poisson",
        description: "Expected home goals divided by league average home goals scored prior to kickoff",
        dependencies: ["historical_goals"],
        owner: "handicaplab-core",
        version: "1.0.0",
        status: "active",
        createdAt: "2026-07-15T12:00:00Z",
        validationStatus: "Verified",
      },
      {
        featureId: "away_defense_strength",
        featureName: "Away Team Defense Rating",
        featureFamily: "poisson",
        description: "Expected away goals conceded divided by league average home goals scored prior to kickoff",
        dependencies: ["historical_goals"],
        owner: "handicaplab-core",
        version: "1.0.0",
        status: "active",
        createdAt: "2026-07-15T12:00:00Z",
        validationStatus: "Verified",
      },
      {
        featureId: "rest_days",
        featureName: "Fatigue Rest Days",
        featureFamily: "fatigue",
        description: "Number of rest days since last competitive fixture",
        dependencies: ["fixtures_schedule"],
        owner: "handicaplab-core",
        version: "1.0.0",
        status: "active",
        createdAt: "2026-07-15T12:00:00Z",
        validationStatus: "Verified",
      },
    ];

    for (const f of defaultFeatures) {
      this.register(f);
    }
  }

  async register(item: FeatureMetadata): Promise<void> {
    this.registeredItems.set(item.featureId, item);
  }

  async get(id: string): Promise<FeatureMetadata> {
    const item = this.registeredItems.get(id);
    if (!item) {
      throw new Error(`Feature with ID ${id} not found in registry.`);
    }
    return item;
  }

  async list(): Promise<FeatureMetadata[]> {
    return Array.from(this.registeredItems.values());
  }

  async validate(id: string): Promise<ValidationResult> {
    const item = await this.get(id);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!item.featureId || item.featureId === '') {
      errors.push('Feature ID cannot be empty.');
    }
    if (item.version === '') {
      errors.push('Feature version is missing.');
    }
    if (item.dependencies.length === 0) {
      warnings.push(`Feature ${id} has no explicit raw dependencies declared.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
