import { supabase } from '@/lib/supabase.server';

export interface FeatureVector {
  entityId: bigint;
  features: Record<string, number>;
  featureVersion: string;
  checksum: string;
}

export class FeatureAssembler {
  /**
   * Assembles a point-in-time feature vector ensuring NO feature leakage.
   * Only features calculated BEFORE the asOfTimestamp are gathered.
   */
  public async assembleVector(
    entityId: bigint,
    featureIds: string[],
    asOfTimestamp: string
  ): Promise<FeatureVector> {
    const { data: values, error } = await supabase
      .from('wh_feature_values')
      .select('feature_id, feature_value, created_at')
      .eq('entity_id', entityId)
      .in('feature_id', featureIds)
      .lte('created_at', asOfTimestamp);

    if (error) {
      throw new Error(`[FeatureAssembler] Failed to query feature values: ${error.message}`);
    }

    const features: Record<string, number> = {};
    for (const fId of featureIds) {
      // Find the most recent value of this feature before asOfTimestamp
      const matching = (values || [])
        .filter(v => v.feature_id === fId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (matching.length === 0) {
        throw new Error(`[FeatureAssembler] Missing required feature value for "${fId}"`);
      }

      features[fId] = Number(matching[0].feature_value);
    }

    return {
      entityId,
      features,
      featureVersion: '1.0.0',
      checksum: 'feature_vector_checksum_hash'
    };
  }
}
