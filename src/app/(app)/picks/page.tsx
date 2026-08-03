import { fetchTodayPicks } from '@/lib/queries/picks';
import { OpportunitiesTable, Opportunity } from '@/components/opportunities/OpportunitiesTable';

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return '';
  }
}

export default async function PicksPage() {
  const picks = await fetchTodayPicks();

  const mappedOpportunities: Opportunity[] = picks.map(p => {
    let signal: 'VALUE' | 'WATCH' | 'PASS' = 'PASS';
    if (p.expectedValue >= 3.0) signal = 'VALUE';
    else if (p.expectedValue >= 1.0) signal = 'WATCH';

    return {
      id: p.id,
      match: `${p.homeTeam} vs ${p.awayTeam}`,
      league: p.competition || 'Unknown',
      time: formatTime(p.kickoff),
      market: p.market.toUpperCase().replace('_', ' '),
      selection: p.pick,
      line: p.market.toLowerCase().includes('handicap') ? (p.pick.split(' ').pop() || '-') : '-',
      modelProb: p.probability,
      marketOdds: p.pinnacleOdds,
      fairOdds: p.fairOdds,
      edge: p.expectedValue, // assuming EV is % in the query or needs formatting
      ev: p.expectedValue,
      signal,
      isStale: false
    };
  });

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground tracking-tight">Active Opportunities</h2>
          <p className="text-sm text-muted-foreground mt-1">Live market pulse and model discrepancies.</p>
        </div>
        
        {/* Placeholder for toolbar filters */}
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded bg-card text-foreground hover:bg-muted transition-colors">
            All Markets
          </button>
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded bg-card text-foreground hover:bg-muted transition-colors">
            Confidence: Any
          </button>
        </div>
      </div>

      {mappedOpportunities.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center shadow-elevation-1">
          <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest mb-4">ENGINE STATUS</div>
          <p className="text-foreground font-medium mb-2">No active opportunities found.</p>
          <p className="text-muted-foreground text-sm">
            Predictions will populate here once the analytical engine processes the next kickoff window.
          </p>
        </div>
      ) : (
        <OpportunitiesTable data={mappedOpportunities} />
      )}
    </div>
  );
}