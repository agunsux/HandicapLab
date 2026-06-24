'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMatches, getPredictionsForMatch } from '@/lib/mock-data';
import { WatchlistButton } from '@/components/WatchlistButton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function WatchlistPage() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
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

  const allMatches = useMemo(() => getMatches(), []);

  // Filter matches that are in the user's watchlist
  const watchlistedMatches = useMemo(() => {
    return allMatches.filter((m) => watchlist.includes(m.id));
  }, [allMatches, watchlist]);

  const hasAdvancedAccess = tier !== 'FREE' && tier !== 'STARTER';
  const isDelayed = tier === 'FREE' || tier === 'STARTER';

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Loading Watchlist Terminal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            Personal Portfolio
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1.5 font-sans">
            User Watchlist
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor ensembled probabilities, ELO form indicators, and value edges for your saved fixtures.
          </p>
        </div>
        {isDelayed && (
          <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded self-start">
            ⚠️ Delayed Feed
          </span>
        )}
      </div>

      {/* Watchlisted matches list */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          {watchlistedMatches.length > 0 ? (
            <Table>
              <TableHeader className="border-b border-slate-800">
                <TableRow className="hover:bg-transparent border-slate-800">
                  <TableHead className="text-slate-450 font-mono text-xs pl-6">Remove</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs">Match & League</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">AH Line / Edge</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">O/U Line / Edge</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Moneyline (H/D/A)</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlistedMatches.map((match) => {
                  const pred = getPredictionsForMatch(match.id);
                  if (!pred) return null;

                  return (
                    <TableRow key={match.id} className="hover:bg-slate-850/40 border-slate-800/60">
                      <TableCell className="py-4 pl-6">
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
                            <span className="text-[10px] text-slate-500 bg-slate-950 px-1 py-0.2 rounded border border-slate-850 mt-1 font-bold">
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
                            <span className="text-[10px] text-slate-500 bg-slate-950 px-1 py-0.2 rounded border border-slate-850 mt-1 font-bold">
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
                            <span className="text-slate-650">•</span>
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-450 border border-slate-850">
                              {Math.round(pred.drawProbability * 100)}%
                            </span>
                            <span className="text-slate-650">•</span>
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
                          <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-mono transition-colors">
                            Open Scanner
                          </button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16 text-slate-500 space-y-3 font-mono text-xs">
              <div>Your watchlist is currently empty.</div>
              <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                Add matches to your watchlist from the main dashboard or the market match scanner to track specific outcomes.
              </p>
              <div className="flex justify-center gap-3 pt-2 font-sans">
                <Link href="/dashboard">
                  <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-755 text-slate-200 text-xs font-semibold transition-colors">
                    Go to Dashboard
                  </button>
                </Link>
                <Link href="/scanner">
                  <button className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors">
                    Go to Scanner
                  </button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
