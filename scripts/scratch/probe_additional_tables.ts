import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../../src/lib/supabase.server';

async function main() {
  const allPotentialTables = [
    'team_features',
    'match_features',
    'edge_calibrations',
    'live_validation_records',
    'odds_platform',
    'closing_odds',
    'sync_checkpoints',
    'attribution_logs',
    'uncertainty_registry',
    'calibration_registry',
    'rivalry_pairs',
    'var_era_rules',
    'quota_state',
    'historical_imports',
    'gold_intelligence',
    'homepage_intelligence',
    'picks_pipeline',
    'picks',
    'user_subscriptions',
    'users'
  ];

  const results: Record<string, any> = {};
  for (const t of allPotentialTables) {
    try {
      const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        results[t] = { exists: false, error: error.message };
      } else {
        results[t] = { exists: true, count: count ?? 0 };
      }
    } catch (e: any) {
      results[t] = { exists: false, error: e.message };
    }
  }
  console.log('Additional table probe:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
