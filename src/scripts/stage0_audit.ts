import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../lib/supabase.server';

async function main() {
  console.log('--- STAGE 0 AUDIT ---');

  // 1. Settled signal count in performance_ledger
  const { count: performanceLedgerCount, error: plError } = await supabase
    .from('performance_ledger')
    .select('*', { count: 'exact', head: true });
  
  if (plError) console.error('Error fetching performance_ledger count:', plError);
  else console.log('Settled signal count in performance_ledger:', performanceLedgerCount);

  // 3. Count predictions by market where status = 'SETTLED' or just group by market
  const { data: markets, error: mError } = await supabase
    .from('predictions')
    .select('market'); // Or market_type if market doesn't exist
    
  if (mError) {
      console.error('Error fetching predictions:', mError);
  } else if (markets) {
    const marketCounts = markets.reduce((acc, row) => {
      acc[row.market || (row as any).market_type || 'unknown'] = (acc[row.market || (row as any).market_type || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Signal count by market:', marketCounts);
  }

  // Check current production data availability. Are there upcoming fixtures?
  const { count: upcomingCount } = await supabase
    .from('matches') // schema shows matches
    .select('*', { count: 'exact', head: true })
    .gte('kickoff', new Date().toISOString());
  console.log('Upcoming fixtures count in matches table:', upcomingCount);
}

main().catch(console.error);
