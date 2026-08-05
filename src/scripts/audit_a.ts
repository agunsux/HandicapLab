import { supabase } from '../lib/supabase.server';

async function run() {
  const { data } = await supabase
    .from('prediction_ledger')
    .select('competition_id');
    
  if (data) {
    const compIds = [...new Set(data.map(d => d.competition_id).filter(Boolean))];
    console.log('Unique competition IDs:', compIds);
    
    if (compIds.length > 0) {
      const { data: comps, error } = await supabase
        .from('wh_competitions')
        .select('api_id, name')
        .in('api_id', compIds);
        
      console.log('Comps query result:', comps, 'Error:', error);
    }
  }
}

run();
