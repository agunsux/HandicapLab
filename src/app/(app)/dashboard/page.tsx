'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMatches, getPredictionsForMatch, getBacktestHistory } from '@/lib/mock-data';
import { WatchlistButton } from '@/components/WatchlistButton';
import Link from 'next/link';

export default function Dashboard() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [filterWatchlist, setFilterWatchlist] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Load tier and watchlist
    const loadState = () => {
      const savedTier = localStorage.getItem('handicaplab_user_tier') as any;
      if (savedTier && ['FREE', 'STARTER', 'PRO', 'QUANT', 'LIFETIME'].includes(savedTier)) {
        setTier(savedTier);
      }
      try {
        const savedWatchlist = localStorage.getItem('handicaplab_watchlist');
        setWatchlist(savedWatchlist ? JSON.parse(savedWatchlist) : []);
      } catch {
        setWatchlist([]);
      }
    };

    loadState();

    window.addEventListener('handicaplab_tier_changed', loadState);
    window.addEventListener('handicaplab_watchlist_changed', loadState);
    window.addEventListener('storage', loadState);

    return () => {
      window.removeEventListener('handicaplab_tier_changed', loadState);
      window.removeEventListener('handicaplab_watchlist_changed', loadState);
      window.removeEventListener('storage', loadState);
    };
  }, []);

  const matches = useMemo(() => getMatches(), []);
  const backtestHistory = useMemo(() => getBacktestHistory(), []);

  // Filter matches that are happening today (within the next 24 hours)
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  const todayMatches = useMemo(() => {
    return matches.filter(
      (m) => m.kickoffTime >= now && m.kickoffTime <= oneDayFromNow
    );
  }, [matches, now, oneDayFromNow]);

  // Determine current match list based on active filters and limits
  const visibleMatches = useMemo(() => {
    let list = [...matches];

    // Filter by Watchlist
    if (filterWatchlist) {
      list = list.filter((m) => watchlist.includes(m.id));
    }

    // Free Tier limits: only see first 3 matches
    if (tier === 'FREE') {
      list = list.slice(0, 3);
    }

    return list;
  }, [matches, watchlist, filterWatchlist, tier]);

  // Find predictions with high edges (e.g. edge > 5%)
  const valueBets = useMemo(() => {
    let list = todayMatches
      .map((match) => {
        const pred = getPredictionsForMatch(match.id);
        return { match, pred };
      })
      .filter(({ pred }) => pred && (pred.handicapEdgePercent > 5 || pred.ouEdgePercent > 5));

    // Watchlist filter
    if (filterWatchlist) {
      list = list.filter(({ match }) => watchlist.includes(match.id));
    }

    // Free tier limits
    if (tier === 'FREE') {
      list = list.slice(0, 2);
    }

    return list;
  }, [todayMatches, filterWatchlist, watchlist, tier]);

  const hasAdvancedAccess = tier !== 'FREE' && tier !== 'STARTER';
  const isDelayed = tier === 'FREE' || tier === 'STARTER';

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Initializing Terminal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            Bloomberg Football Terminal
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1.5 font-sans">
            Football Market Intelligence Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time quant model probability outputs, market inefficiency detection, and Closing Line Value (CLV) diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Watchlist Filter Toggle */}
          <button
            onClick={() => setFilterWatchlist(!filterWatchlist)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all ${
              filterWatchlist
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={filterWatchlist ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-star"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Watchlist Only ({watchlist.length})</span>
          </button>
          
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 font-mono text-xs">
            <span className="text-slate-400">fixtures today:</span>
            <span className="text-white font-bold">{todayMatches.length}</span>
          </div>
        </div>
      </div>

      {/* Grid of Top Value Bets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            High-Edge Quantitative Value Detected
          </h2>
          {isDelayed && (
            <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              ⚠️ Delayed Data (60m delay active)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {valueBets.length > 0 ? (
            valueBets.map(({ match, pred }) => {
              if (!pred) return null;
              
              const ahEdge = pred.handicapEdgePercent;
              const ouEdge = pred.ouEdgePercent;

              return (
                <Card key={match.id} className="bg-slate-900 border-slate-800 hover:border-emerald-500/30 transition-all relative overflow-hidden">
                  <div className="absolute top-4 right-4 z-10">
                    <WatchlistButton matchId={match.id} />
                  </div>
                  <CardHeader className="pb-3 border-b border-slate-800/50 pr-16">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-400">{match.league}</span>
                      <span className="text-slate-650">•</span>
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
                          {hasAdvancedAccess ? (
                            <div className="text-emerald-400 font-bold text-base">+{ahEdge}%</div>
                          ) : (
                            <span className="inline-block mt-0.5 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded font-bold">
                              🔒 Pro
                            </span>
                          )}
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Confidence</div>
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mt-1">
                            {pred.confidenceScore}/100
                          </Badge>
                        </div>
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
                          {hasAdvancedAccess ? (
                            <div className="text-emerald-400 font-bold text-base">+{ouEdge}%</div>
                          ) : (
                            <span className="inline-block mt-0.5 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded font-bold">
                              🔒 Pro
                            </span>
                          )}
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Probability</div>
                          {hasAdvancedAccess ? (
                            <div className="text-slate-300 font-semibold text-sm mt-0.5">
                              {Math.round(pred.overProbability * 100)}%
                            </div>
                          ) : (
                            <span className="inline-block mt-0.5 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded font-bold">
                              🔒 Pro
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-2 text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg font-mono text-xs">
              No high-edge value opportunities identified in this view.
            </div>
          )}
        </div>
      </section>

      {/* Main Grid: Fixture List & Backtest */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's & Upcoming Fixtures Table (2/3 width on large screens) */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Quantitative Model Outputs & Calibration
          </h2>
          <Card className="bg-slate-900 border-slate-800 relative overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="border-b border-slate-800">
                  <TableRow className="hover:bg-transparent border-slate-800">
                    <TableHead className="text-slate-400 font-mono text-xs">Watch</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs">Match & League</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">AH Line / Edge</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">O/U Line / Edge</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-center">Moneyline (H/D/A)</TableHead>
                    <TableHead className="text-slate-400 font-mono text-xs text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMatches.map((match) => {
                    const pred = getPredictionsForMatch(match.id);
                    if (!pred) return null;

                    return (
                      <TableRow key={match.id} className="hover:bg-slate-850/40 border-slate-800/60">
                        <TableCell className="py-4 pl-4">
                          <WatchlistButton matchId={match.id} />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {match.homeTeam?.name} vs {match.awayTeam?.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5" suppressHydrationWarning>
                              {match.league} • {new Date(match.kickoffTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(match.kickoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono py-4">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-slate-300">
                              {pred.handicapLine > 0 ? `+${pred.handicapLine}` : pred.handicapLine}
                            </span>
                            {hasAdvancedAccess ? (
                              <span className={`text-xs font-bold mt-0.5 ${pred.handicapEdgePercent > 5 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {pred.handicapEdgePercent > 0 ? `+${pred.handicapEdgePercent}%` : `${pred.handicapEdgePercent}%`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-950 px-1 py-0.2 rounded border border-slate-850 mt-1">
                                🔒 Pro
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono py-4">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-slate-300">Over {pred.totalLine}</span>
                            {hasAdvancedAccess ? (
                              <span className={`text-xs font-bold mt-0.5 ${pred.ouEdgePercent > 5 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {pred.ouEdgePercent > 0 ? `+${pred.ouEdgePercent}%` : `${pred.ouEdgePercent}%`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-950 px-1 py-0.2 rounded border border-slate-850 mt-1">
                                🔒 Pro
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-4">
                          {hasAdvancedAccess ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-850">
                                {Math.round(pred.homeProbability * 100)}%
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-450 border border-slate-850">
                                {Math.round(pred.drawProbability * 100)}%
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-850">
                                {Math.round(pred.awayProbability * 100)}%
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 opacity-50 blur-[2px] select-none font-mono">
                              <span>33%</span>•<span>33%</span>•<span>33%</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-4 pr-6">
                          <Link href="/scanner">
                            <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors">
                              Open Scanner
                            </button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {visibleMatches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500 font-mono text-xs">
                        {filterWatchlist
                          ? 'No watchlisted matches found.'
                          : 'No fixtures found.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>

            {/* Paywall Gate UI Overlay for Free Plan */}
            {tier === 'FREE' && matches.length > 3 && (
              <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex flex-col justify-end items-center pb-6 px-4 text-center z-20">
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl max-w-md shadow-2xl backdrop-blur-md space-y-2">
                  <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2">
                    <span>🔒</span> Free Tier Limit Reached
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    You are viewing a limited set of daily fixtures. Upgrade your membership tier to view unlimited matches, real-time odds snapshots, and eliminate data delays.
                  </p>
                  <Link href="/pricing" className="inline-block mt-2">
                    <button className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors">
                      Upgrade Subscription
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Historical Backtesting Performance Panel (1/3 width on large screens) */}
        <section id="backtest" className="space-y-4">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Model Backtesting Performance
          </h2>
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
