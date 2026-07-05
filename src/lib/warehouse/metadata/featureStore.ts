import { supabase } from '@/lib/supabase.server';

export interface FeatureRegistryModel {
  featureId: string;
  version: string;
  description: string;
  dependencies: string[];
  sourceDataset: string;
  generatorVersion: string;
  owner: string;
  tags: string[];
  isDeprecated?: boolean;
}

export interface FeatureLineageModel {
  featureId: string;
  inputDataset: string;
  transformationSteps: string[];
  generatorVersion: string;
}

export interface FeatureValidationResult {
  nullPct: number;
  outlierCount: number;
  isValid: boolean;
  errors: string[];
}

export class FeatureGenerator {
  /**
   * Generates rolling goal average features for teams.
   */
  public generateTeamGoalAverage(fixtures: any[], teamId: number): number {
    const teamFixtures = fixtures.filter(
      f => (f.home_team_id === teamId || f.away_team_id === teamId) && f.status === 'finished'
    );

    if (teamFixtures.length === 0) return 0.0;

    let totalGoals = 0;
    for (const f of teamFixtures) {
      if (f.home_team_id === teamId) {
        totalGoals += f.home_goals || 0;
      } else {
        totalGoals += f.away_goals || 0;
      }
    }

    return Number((totalGoals / teamFixtures.length).toFixed(4));
  }

  /**
   * Generates market overround values.
   */
  public generateMarketOverround(homeOdds: number, awayOdds: number, drawOdds?: number): number {
    if (homeOdds <= 0 || awayOdds <= 0) return 0.0;
    const overround = (1 / homeOdds) + (1 / awayOdds) + (drawOdds ? 1 / drawOdds : 0);
    return Number((overround - 1.0).toFixed(4));
  }
}

export class FeatureValidator {
  /**
   * Validates generated feature statistics against strict constraints.
   */
  public static validate(values: number[]): FeatureValidationResult {
    const total = values.length;
    if (total === 0) {
      return { nullPct: 0, outlierCount: 0, isValid: true, errors: [] };
    }

    let nulls = 0;
    let outliers = 0;
    const errors: string[] = [];

    for (const v of values) {
      if (v === null || v === undefined || isNaN(v)) {
        nulls++;
      } else {
        // Feature bounds checks (e.g. values exceeding 10.0 or below -10.0 for standard scores)
        if (v > 10.0 || v < -10.0) {
          outliers++;
        }
      }
    }

    const nullPct = (nulls / total) * 100;
    if (nullPct > 5.0) {
      errors.push(`Validation failure: Null percentage is too high (${nullPct.toFixed(2)}%)`);
    }
    if (outliers > 0) {
      errors.push(`Validation warning: Detected ${outliers} outlier values.`);
    }

    return {
      nullPct: Number(nullPct.toFixed(2)),
      outlierCount: outliers,
      isValid: errors.length === 0 || nullPct <= 5.0,
      errors
    };
  }
}

export class FeatureStoreService {
  /**
   * Registers a feature configuration into the feature store catalog.
   */
  public async registerFeature(model: FeatureRegistryModel): Promise<FeatureRegistryModel> {
    const payload = {
      feature_id: model.featureId,
      version: model.version,
      description: model.description,
      dependencies: model.dependencies,
      source_dataset: model.sourceDataset,
      generator_version: model.generatorVersion,
      owner: model.owner,
      tags: model.tags,
      is_deprecated: model.isDeprecated || false
    };

    const { data, error } = await supabase
      .from('wh_feature_registry')
      .upsert(payload, { onConflict: 'feature_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`[FeatureStore] Upsert failed: ${error.message}`);
    }

    return {
      featureId: data.feature_id,
      version: data.version,
      description: data.description,
      dependencies: data.dependencies,
      sourceDataset: data.source_dataset,
      generatorVersion: data.generator_version,
      owner: data.owner,
      tags: data.tags,
      isDeprecated: data.is_deprecated
    };
  }

  /**
   * Stores lineage audits for features.
   */
  public async addLineage(lineage: FeatureLineageModel): Promise<void> {
    const payload = {
      feature_id: lineage.featureId,
      input_dataset: lineage.inputDataset,
      transformation_steps: lineage.transformationSteps,
      generator_version: lineage.generatorVersion
    };

    const { error } = await supabase.from('wh_feature_lineage').insert(payload);
    if (error) {
      throw new Error(`[FeatureLineage] Failed to store lineage: ${error.message}`);
    }
  }

  /**
   * Searches the catalog by tags or generator metadata.
   */
  public async searchCatalog(tag: string): Promise<FeatureRegistryModel[]> {
    const { data, error } = await supabase
      .from('wh_feature_registry')
      .select('*')
      .contains('tags', [tag]);

    if (error || !data) return [];

    return data.map(item => ({
      featureId: item.feature_id,
      version: item.version,
      description: item.description,
      dependencies: item.dependencies,
      sourceDataset: item.source_dataset,
      generatorVersion: item.generator_version,
      owner: item.owner,
      tags: item.tags,
      isDeprecated: item.is_deprecated
    }));
  }
}
