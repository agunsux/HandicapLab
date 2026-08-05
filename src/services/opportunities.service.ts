import { supabase } from '@/lib/supabase.server';
import { determineUserAccess } from '@/lib/signals/visibility';
import { Opportunity } from '@/components/opportunities/OpportunitiesTable';

export async function getSecureOpportunities(userId?: string, limit = 50): Promise<Opportunity[]> {
  const { isPremium, dailyLimit } = await determineUserAccess(userId);

  const FREE_COLUMNS = 'id, home_team, away_team, prediction_timestamp, cohort_tag, market_type, market, market_subtype';
  const PREMIUM_COLUMNS = `${FREE_COLUMNS}, selection, expected_value, model_probability, home_win_prob, entry_odds, predicted_odds, odds, fair_odds`;

  const premiumLimit = isPremium ? limit : dailyLimit;
  const lockedLimit = limit - premiumLimit;
  
  let results: Opportunity[] = [];
  const now = '2020-01-01T00:00:00Z'; // For testing purposes to fetch old DB records

  // 1. Fetch unlocked rows WITH premium data
  if (premiumLimit > 0) {
    const { data: premiumRows, error } = await supabase
      .from('prediction_ledger_v3')
      .select(PREMIUM_COLUMNS)
      .gte('prediction_timestamp', now)
      .order('expected_value', { ascending: false })
      .limit(premiumLimit);

    if (!error && premiumRows) {
      results = results.concat(premiumRows.map((p: any) => {
        const baseFields = {
          id: p.id,
          match: `${p.home_team} vs ${p.away_team}`,
          league: p.cohort_tag || 'Unknown',
          time: new Date(p.prediction_timestamp).toLocaleString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          }),
          market: p.market_type || p.market || p.market_subtype || 'ML',
          isStale: false
        };

        let signal: 'VALUE' | 'WATCH' | 'PASS' = 'PASS';
        if (p.expected_value >= 3.0) signal = 'VALUE';
        else if (p.expected_value >= 1.0) signal = 'WATCH';

        return {
          ...baseFields,
          locked: false,
          selection: p.selection,
          line: p.selection?.includes('Handicap') ? p.selection.split(' ').pop() || '-' : '-',
          modelProb: (p.model_probability || p.home_win_prob || 0),
          marketOdds: (p.entry_odds || p.predicted_odds || p.odds || 0.00),
          fairOdds: (p.fair_odds || 0.00),
          edge: p.expected_value || 0,
          ev: p.expected_value || 0,
          signal
        } as Opportunity;
      }));
    }
  }

  // 2. Fetch locked rows WITHOUT premium data
  if (!isPremium && lockedLimit > 0) {
    const { data: lockedRows, error } = await supabase
      .from('prediction_ledger_v3')
      .select(FREE_COLUMNS)
      .gte('prediction_timestamp', now)
      .order('expected_value', { ascending: false })
      .range(premiumLimit, limit - 1);

    if (!error && lockedRows) {
      results = results.concat(lockedRows.map((p: any) => {
        return {
          id: p.id,
          match: `${p.home_team} vs ${p.away_team}`,
          league: p.cohort_tag || 'Unknown',
          time: new Date(p.prediction_timestamp).toLocaleString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          }),
          market: p.market_type || p.market || p.market_subtype || 'ML',
          isStale: false,
          locked: true
        } as Opportunity;
      }));
    }
  }

  return results;
}
