import { supabase } from '@/lib/supabase';

export interface PerformanceStats {
  total_predictions: number;
  total_roi: number;
  yield_percentage: number;
  hit_rate: {
    ah: number;
    ou: number;
    ml: number;
    btts: number;
  };
}

export async function getModelPerformance(modelVersion: string = 'v0.1'): Promise<PerformanceStats> {
  const { data: outcomes, error } = await supabase
    .from('outcomes')
    .select(`
      roi,
      result_ah,
      result_ou,
      result_ml,
      result_btts,
      predictions!inner(model_version)
    `)
    .eq('predictions.model_version', modelVersion);

  if (error || !outcomes || outcomes.length === 0) {
    return {
      total_predictions: 0,
      total_roi: 0,
      yield_percentage: 0,
      hit_rate: { ah: 0, ou: 0, ml: 0, btts: 0 }
    };
  }

  let total_roi = 0;
  let wins_ah = 0, valid_ah = 0;
  let wins_ou = 0, valid_ou = 0;
  let wins_ml = 0, valid_ml = 0;
  let wins_btts = 0, valid_btts = 0;

  outcomes.forEach(o => {
    total_roi += o.roi || 0;
    
    if (o.result_ah !== 'push') {
      valid_ah++;
      if (o.result_ah === 'win') wins_ah++;
    }
    if (o.result_ou !== 'push') {
      valid_ou++;
      if (o.result_ou === 'win') wins_ou++;
    }
    if (o.result_ml !== 'push') {
      valid_ml++;
      if (o.result_ml === 'win') wins_ml++;
    }
    if (o.result_btts !== 'push') {
      valid_btts++;
      if (o.result_btts === 'win') wins_btts++;
    }
  });

  // Calculate yield (assuming 1 unit bet per market per match = 4 units total)
  // This is a simplified calculation.
  const total_units_staked = outcomes.length * 4; 
  const yield_percentage = total_units_staked > 0 ? (total_roi / total_units_staked) * 100 : 0;

  return {
    total_predictions: outcomes.length,
    total_roi,
    yield_percentage,
    hit_rate: {
      ah: valid_ah > 0 ? wins_ah / valid_ah : 0,
      ou: valid_ou > 0 ? wins_ou / valid_ou : 0,
      ml: valid_ml > 0 ? wins_ml / valid_ml : 0,
      btts: valid_btts > 0 ? wins_btts / valid_btts : 0,
    }
  };
}
