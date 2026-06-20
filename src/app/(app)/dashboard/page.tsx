import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMatches, getPredictionsForMatch, getBacktestHistory } from '@/lib/mock-data';
import Link from 'next/link';

export default function Dashboard() {
  const matches = getMatches();
  const backtestHistory = getBacktestHistory();

  // Filter matches that are happening today (within the next 24 hours)
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayMatches = matches.filter(
    (m) => m.kickoffTime >= now && m.kickoffTime <= oneDayFromNow
  );

  // Find predictions with high edges (e.g. edge > 5%)
  const valueBets = todayMatches
    .map((match) => {
      const pred = getPredictionsForMatch(match.id);
      return { match, pred };
    })
    .filter(({ pred }) => pred && (pred.handicapEdgePercent > 5 || pred.ouEdgePercent > 5));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Today's Market Intelligence</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time market probability analysis, edge computation, and value identification.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 self-start font-mono text-xs">
          <span className="text-slate-400">Total Analyzed Today:</span>
          <span className="text-white font-bold">{todayMatches.length} Fixtures</span>
        </div>
      </div>

      {/* Grid of Top Value Bets */}
      <section className="space-y-4">
        <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">High-Edge Value Detected</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {valueBets.length > 0 ? (
            valueBets.map(({ match, pred }) => {
              if (!pred) return null;
              
              // We'll show two highlights: one for Asian Handicap and one for Over/Under
              const ahEdge = pred.handicapEdgePercent;
              const ouEdge = pred.ouEdgePercent;

              return (
                <Card key={match.id} className="bg-slate-900 border-slate-800 hover:border-emerald-500/30 transition-all">
                  <CardHeader className="pb-3 border-b border-slate-800/50">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">{match.league}</span>
                      <span className="text-slate-400" suppressHydrationWarning>
                        {new Date(match.kickoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold text-white mt-1">
                      {match.homeTeam?.name} vs {match.awayTeam?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* Asian Handicap Item */}
                    {ahEdge > 5 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                        <div>
                          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Asian Handicap</div>
                          <div className="font-semibold text-white mt-0.5">
                            {match.homeTeam?.name} {pred.handicapLine > 0 ? `+${pred.handicapLine}` : pred.handicapLine}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Model Edge</div>
                          <div className="text-emerald-400 font-bold text-base">+{ahEdge}%</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Confidence</div>
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mt-1">
                            {pred.confidenceScore}/100
                          </Badge>
                        </div>
                        <Link href={`/match/${match.id}`} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono">
                          Details
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
                        </Link>
                      </div>
                    )}

                    {/* Over/Under Item */}
                    {ouEdge > 5 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                        <div>
                          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Over/Under goals</div>
                          <div className="font-semibold text-white mt-0.5">
                            Over {pred.totalLine} Goals
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Model Edge</div>
                          <div className="text-emerald-400 font-bold text-base">+{ouEdge}%</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Probability</div>
                          <div className="text-slate-300 font-semibold text-sm">
                            {Math.round(pred.overProbability * 100)}%
                          </div>
                        </div>
                        <Link href={`/match/${match.id}`} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono">
                          Details
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-2 text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No high-edge value bets identified in the next 24 hours.
            </div>
          )}
        </div>
      </section>

      {/* Main Grid: Fixture List & Backtest */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's & Upcoming Fixtures Table (2/3 width on large screens) */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">Live Fixtures & Probability Outputs</h2>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="border-b border-slate-800">
                  <TableRow className="hover:bg-transparent border-slate-800">
                    <TableHead className="text-slate-400 font-mono text-xs">Match & League</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">AH Line / Edge</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">O/U Line / Edge</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">Moneyline (H/D/A)</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => {
                    const pred = getPredictionsForMatch(match.id);
                    if (!pred) return null;

                    return (
                      <TableRow key={match.id} className="hover:bg-slate-850/40 border-slate-800/60">
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {match.homeTeam?.name} vs {match.awayTeam?.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5" suppressHydrationWarning>
                              {match.league} • {match.kickoffTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} {match.kickoffTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono py-4">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-slate-300">
                              {pred.handicapLine > 0 ? `+${pred.handicapLine}` : pred.handicapLine}
                            </span>
                            <span className={`text-xs font-bold mt-0.5 ${pred.handicapEdgePercent > 5 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {pred.handicapEdgePercent > 0 ? `+${pred.handicapEdgePercent}%` : `${pred.handicapEdgePercent}%`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono py-4">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-slate-300">Over {pred.totalLine}</span>
                            <span className={`text-xs font-bold mt-0.5 ${pred.ouEdgePercent > 5 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {pred.ouEdgePercent > 0 ? `+${pred.ouEdgePercent}%` : `${pred.ouEdgePercent}%`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-4">
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800">
                              {Math.round(pred.homeProbability * 100)}%
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                              {Math.round(pred.drawProbability * 100)}%
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800">
                              {Math.round(pred.awayProbability * 100)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <Link href={`/match/${match.id}`}>
                            <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium transition-colors text-white">
                              Analyze
                            </button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Historical Backtesting Performance Panel (1/3 width on large screens) */}
        <section id="backtest" className="space-y-4">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">Model Backtesting Performance</h2>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-white">Historical Calibration</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Tracked since May 2026. Cumulative performance of positive edge selections.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overall KPI widgets */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Win Rate</div>
                  <div className="text-2xl font-bold text-white mt-1">60.1%</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Cumulative ROI</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">+14.7%</div>
                </div>
              </div>

              {/* Progress Chart Log table */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-slate-500 uppercase px-1">Performance Trend Logs</div>
                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-slate-500 bg-slate-900/30">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-center">Bets</th>
                        <th className="py-2 px-3 text-center">Win %</th>
                        <th className="py-2 px-3 text-right">Cum. ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {backtestHistory.slice(-5).map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 text-slate-300">
                          <td className="py-2.5 px-3 text-left font-medium">{log.date}</td>
                          <td className="py-2.5 px-3 text-center text-slate-400">{log.totalBets}</td>
                          <td className="py-2.5 px-3 text-center">{log.winRate}%</td>
                          <td className={`py-2.5 px-3 text-right font-semibold ${log.cumulativeRoi > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            +{log.cumulativeRoi}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/50 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-white block">Verification Method:</span>
                Predictions are tracked against closed market closing odds. Backtests assume flat 1-unit stakes on matches where calculated value edge exceeds +3.0%.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
