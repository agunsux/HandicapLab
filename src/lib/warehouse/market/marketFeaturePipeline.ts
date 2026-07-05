import { IMarketFeature, FeatureResult } from './interfaces';
import { CLVFeature } from './plugins/clv';
import { OddsVelocityFeature } from './plugins/oddsVelocity';
import { SteamMoveFeature } from './plugins/steamMove';
import { RLMFeature } from './plugins/rlm';
import { PinnacleDivergenceFeature } from './plugins/pinnacleDivergence';
import { MarketPressureFeature } from './plugins/marketPressure';
import { OddsDispersionFeature } from './plugins/oddsDispersion';
import { supabase } from '@/lib/supabase.server';

export class MarketFeaturePipeline {
  private readonly plugins: IMarketFeature[];

  constructor() {
    this.plugins = [
      new CLVFeature(),
      new OddsVelocityFeature(),
      new SteamMoveFeature(),
      new RLMFeature(),
      new PinnacleDivergenceFeature(),
      new MarketPressureFeature(),
      new OddsDispersionFeature()
    ];
  }

  /**
   * Runs the plugin pipeline on given match snapshots and registers values.
   */
  public async execute(
    entityId: bigint,
    snapshots: any[],
    openingOdds: number,
    closingOdds: number,
    asOfTimestamp: string
  ): Promise<Record<string, FeatureResult>> {
    const results: Record<string, FeatureResult> = {};

    for (const plugin of this.plugins) {
      const outcome = plugin.compute(snapshots, openingOdds, closingOdds);
      results[plugin.getName()] = outcome;

      // Only save to warehouse database if the feature vector quality is sufficient (> 0.50)
      if (outcome.quality >= 0.50) {
        const dbPayload = {
          entity_id: Number(entityId),
          feature_id: `${plugin.getName()}_v${plugin.getVersion()}`,
          feature_value: outcome.value,
          created_at: asOfTimestamp
        };

        const { error } = await supabase
          .from('wh_feature_values')
          .upsert(dbPayload, { onConflict: 'entity_id,feature_id' });

        if (error) {
          console.error(`[MarketFeaturePipeline] Save failed for ${plugin.getName()}: ${error.message}`);
        }
      }
    }

    return results;
  }
}
