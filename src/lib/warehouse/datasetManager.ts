import { supabase } from '@/lib/supabase.server';
import { FeatureStore } from './featureStore';

export class DatasetManager {
  /**
   * Registers a new feature engineering version descriptor.
   */
  public static async registerFeatureVersion(versionTag: string, description: string, schema?: any) {
    const { data: existing } = await supabase
      .from('wh_feature_versions')
      .select('id')
      .eq('version_tag', versionTag)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    const { data: inserted, error } = await supabase
      .from('wh_feature_versions')
      .insert({
        version_tag: versionTag,
        description,
        schema_json: schema || {}
      })
      .select('id')
      .single();

    if (error) throw error;
    return inserted.id;
  }

  /**
   * Computes, updates, and saves features for a given fixture and version tag.
   */
  public static async materializeFixtureFeatures(fixtureId: string, versionTag: string) {
    // Get feature version ID
    const { data: version } = await supabase
      .from('wh_feature_versions')
      .select('id')
      .eq('version_tag', versionTag)
      .maybeSingle();

    if (!version) {
      throw new Error(`Feature version tag ${versionTag} is not registered`);
    }

    // Fetch fixture teams and kickoff
    const { data: fixture } = await supabase
      .from('wh_fixtures')
      .select('home_team_id, away_team_id, kickoff_time')
      .eq('id', fixtureId)
      .single();

    if (!fixture) {
      throw new Error(`Fixture ${fixtureId} does not exist`);
    }

    const features = await FeatureStore.computeFixtureFeatures(
      fixtureId,
      fixture.home_team_id,
      fixture.away_team_id,
      fixture.kickoff_time
    );

    // Save/Upsert in Feature Store
    const { error } = await supabase
      .from('wh_feature_store')
      .upsert({
        fixture_id: fixtureId,
        version_id: version.id,
        features: features as any,
        generated_at: new Date().toISOString()
      }, { onConflict: 'fixture_id,version_id' });

    if (error) throw error;
    return features;
  }

  /**
   * Pulls all features and target outcome variables for a specific version tag.
   * Perfect for model training/reproducibility.
   */
  public static async getDatasetSnapshot(versionTag: string) {
    const { data, error } = await supabase
      .from('wh_feature_store')
      .select(`
        features,
        fixture:wh_fixtures (
          id,
          home_team_id,
          away_team_id,
          home_goals,
          away_goals,
          kickoff_time,
          status
        ),
        version:wh_feature_versions!inner (
          version_tag
        )
      `)
      .eq('version.version_tag', versionTag);

    if (error) throw error;
    return (data || []).map((row: any) => ({
      features: row.features,
      fixture: row.fixture,
      version_tag: row.version?.version_tag || versionTag
    }));
  }
}
