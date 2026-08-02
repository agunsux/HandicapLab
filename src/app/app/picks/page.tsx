import React from 'react';
import { supabase } from '@/lib/supabase.server';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';
import { FilterBar } from '@/components/app-shell/FilterBar';

export const dynamic = 'force-dynamic';

export default async function PicksPage() {
  // Fetch today's best value bets from the database
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, fixtures(*)')
    .gte('fixtures.kickoff_time', new Date().toISOString())
    .order('expected_value', { ascending: false })
    .limit(50);

  // Map to new Opportunity type for the table
  const mappedOpportunities: Opportunity[] = (predictions || []).map((p: any) => {
    // Basic signal logic based on EV
    let signal: 'VALUE' | 'WATCH' | 'PASS' = 'PASS';
    if (p.expected_value >= 3.0) signal = 'VALUE';
    else if (p.expected_value >= 1.0) signal = 'WATCH';

    return {
      id: p.id,
      match: `${p.fixtures?.home_team} vs ${p.fixtures?.away_team}`,
      league: p.fixtures?.competition_name || 'Unknown',
      time: new Date(p.fixtures?.kickoff_time).toLocaleString(undefined, { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      }),
      market: p.market,
      selection: p.selection,
      line: p.selection.includes('Handicap') ? p.selection.split(' ').pop() || '-' : '-',
      modelProb: (p.home_win_prob || p.model_probability || 0), // fallback if needed
      marketOdds: p.odds || 0.00,
      fairOdds: p.fair_odds || 0.00,
      edge: p.expected_value || 0,
      ev: p.expected_value || 0, // Using EV identically to edge for now based on previous mapping
      signal,
      isStale: false // to be connected to actual stale logic
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Today's Opportunities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Expected value edges sorted by highest expected return.
          </p>
        </div>
      </div>
      
      {/* We use a static filter bar here since server components can't use useState directly. 
          A proper client component wrapper might be needed if interactive filtering is built. */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none items-center border-b border-border">
        <button className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] border-primary text-foreground">All</button>
        <button className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] border-transparent text-muted-foreground hover:text-foreground">Moneyline</button>
        <button className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] border-transparent text-muted-foreground hover:text-foreground">Asian Handicap</button>
        <button className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px] border-transparent text-muted-foreground hover:text-foreground">Over/Under</button>
      </div>

      <div className="flex-1 mt-2">
        <OpportunitiesTable data={mappedOpportunities} />
      </div>
    </div>
  );
}
