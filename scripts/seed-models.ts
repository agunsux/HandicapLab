import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });
import { createClient } from '@supabase/supabase-js';

async function seed() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(url, key);

  const models = [
    {
      id: 'AH-dixoncoles-v1.0.0',
      market_scope: 'AH',
      architecture_description: 'Dixon-Coles bivariate goal matrix, time-weighted decay, rho per fold',
      hypothesis: 'Baseline champion from EPIC 56 calibration tournament',
      frozen_parameters: { rho: -0.05, shrinkage: 0.0, decay_xi: 0.0019, max_goals: 6 },
      backtest_status: 'COMPLETE',
      validation_state: 'RESEARCH_ONLY',
      backtest_realized_roi: -2.30,
      backtest_clv_mean: -0.0311,
      backtest_clv_pvalue: 0.555,
      backtest_n_bets: 7225,
    },
    {
      id: 'AH-dixoncoles-shrink10-v1.0.1',
      market_scope: 'AH',
      architecture_description: 'Dixon-Coles + 10% shrinkage toward market',
      hypothesis: 'Reduce overconfidence via 10% market blend',
      frozen_parameters: { rho: -0.05, shrinkage: 0.10, decay_xi: 0.0019, max_goals: 6 },
      backtest_status: 'COMPLETE',
      validation_state: 'RESEARCH_ONLY',
      backtest_realized_roi: -2.00,
      backtest_clv_mean: 0.0086,
      backtest_clv_pvalue: 0.92,
      backtest_n_bets: 5831,
    },
    {
      id: 'AH-dixoncoles-shrink20-v1.0.2',
      market_scope: 'AH',
      architecture_description: 'Dixon-Coles + 20% shrinkage toward market',
      hypothesis: 'Reduce overconfidence via 20% market blend',
      frozen_parameters: { rho: -0.05, shrinkage: 0.20, decay_xi: 0.0019, max_goals: 6 },
      backtest_status: 'COMPLETE',
      validation_state: 'RESEARCH_ONLY',
      backtest_realized_roi: -1.90,
      backtest_clv_mean: 0.0431,
      backtest_clv_pvalue: 0.63,
      backtest_n_bets: 5805,
    },
    {
      id: 'AH-dixoncoles-shrink30-v1.0.3',
      market_scope: 'AH',
      architecture_description: 'Dixon-Coles + 30% shrinkage toward market',
      hypothesis: 'Reduce overconfidence via 30% market blend',
      frozen_parameters: { rho: -0.05, shrinkage: 0.30, decay_xi: 0.0019, max_goals: 6 },
      backtest_status: 'COMPLETE',
      validation_state: 'RESEARCH_ONLY',
      backtest_realized_roi: -2.23,
      backtest_clv_mean: 0.0705,
      backtest_clv_pvalue: 0.43,
      backtest_n_bets: 5778,
    }
  ];

  console.log('Seeding model_versions...');
  const { data, error } = await supabase.from('model_versions').upsert(models, { onConflict: 'id' }).select();
  if (error) {
    console.error('Seed model_versions error:', error);
  } else {
    console.log(`✅ Successfully seeded ${data?.length || models.length} models into model_versions.`);
  }

  const { data: fetchAll, error: fetchErr } = await supabase.from('model_versions').select('*');
  console.log('Current model_versions count:', fetchAll?.length);
  if (fetchAll) {
    console.log('IDs:', fetchAll.map(m => m.id));
  }
}

seed().catch(console.error);
