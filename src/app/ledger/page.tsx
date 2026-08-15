import { supabase } from '@/lib/supabase.server';

export const revalidate = 60; // Cache for 60 seconds

export default async function PublicLedgerPage() {
  let statsData: any[] | null = null;
  let recentTrades: any[] | null = null;

  try {
    const statsRes = await supabase
      .from('paper_trades')
      .select('status, profit_loss, stake, entry_odds, odds');
    statsData = statsRes.data;

    const recentRes = await supabase
      .from('paper_trades')
      .select(`
        id,
        created_at,
        market_type,
        selection,
        odds,
        entry_odds,
        status,
        profit_loss,
        predictions (
          confidence,
          prediction
        ),
        matches (
          home_team,
          away_team,
          kickoff
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    recentTrades = recentRes.data;
  } catch (err) {
    console.error('[PublicLedgerPage] Failed to fetch ledger data:', err);
  }

  let totalTrades = 0;
  let wonTrades = 0;
  let settledTrades = 0;
  let cumulativePnL = 0;

  if (statsData) {
    totalTrades = statsData.length;
    for (const t of statsData) {
      if (t.status === 'WON' || t.status === 'won') {
        wonTrades++;
        settledTrades++;
      } else if (t.status === 'LOST' || t.status === 'lost') {
        settledTrades++;
      }
      cumulativePnL += Number(t.profit_loss || 0);
    }
  }

  const winRate = settledTrades > 0 ? ((wonTrades / settledTrades) * 100).toFixed(1) + '%' : '--%';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pt-16">
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Public Ledger</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Transparent. Verifiable. No secrets. Every prediction and its outcome is recorded here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Predictions</div>
              <div className="text-4xl font-bold">{totalTrades}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Win Rate</div>
              <div className="text-4xl font-bold text-primary">{winRate}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cumulative P&L</div>
              <div className={`text-4xl font-bold ${cumulativePnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {cumulativePnL >= 0 ? '+' : '-'}${Math.abs(cumulativePnL).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Recent Predictions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Match</th>
                    <th className="px-6 py-3 font-medium">Market</th>
                    <th className="px-6 py-3 font-medium">Pick</th>
                    <th className="px-6 py-3 font-medium text-right">Odds</th>
                    <th className="px-6 py-3 font-medium text-right">Conf</th>
                    <th className="px-6 py-3 font-medium text-center">Result</th>
                    <th className="px-6 py-3 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTrades?.map((trade) => {
                    const match = Array.isArray(trade.matches) ? trade.matches[0] : trade.matches;
                    const predictionObj = Array.isArray(trade.predictions) ? trade.predictions[0] : trade.predictions;
                    const conf = predictionObj?.confidence 
                      ? (predictionObj.confidence * 100).toFixed(1) + '%' 
                      : '--';
                    
                    const pnl = Number(trade.profit_loss || 0);
                    const status = (trade.status || '').toUpperCase();
                    
                    let statusColor = 'text-muted-foreground';
                    let statusText = 'Awaiting';
                    if (status === 'WON') {
                      statusColor = 'text-green-500 font-semibold';
                      statusText = 'Won';
                    } else if (status === 'LOST') {
                      statusColor = 'text-red-500 font-semibold';
                      statusText = 'Lost';
                    } else if (status === 'VOID') {
                      statusColor = 'text-yellow-500 font-semibold';
                      statusText = 'Void';
                    }

                    return (
                      <tr key={trade.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          {new Date(trade.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {match ? `${match.home_team} vs ${match.away_team}` : 'Unknown Match'}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {trade.market_type}
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize">{trade.selection}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {Number(trade.entry_odds || trade.odds || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {conf}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={statusColor}>{statusText}</span>
                        </td>
                        <td className={`px-6 py-4 text-right ${pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : ''}`}>
                          {status === 'PENDING' ? '--' : (pnl > 0 ? '+' : '') + pnl.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {(!recentTrades || recentTrades.length === 0) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                        No recent predictions available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
