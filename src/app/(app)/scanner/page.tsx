'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WatchlistButton } from '@/components/WatchlistButton';
import Link from 'next/link';

interface MatchPrediction {
  matchId: string;
  match: string;
  kickoff: string;
  league: string;
  prediction: {
    home: number | null;
    draw: number | null;
    away: number | null;
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
  } | null;
  asianHandicap: {
    line: string;
    confidence: number | null;
    odds: number;
    fairOdds: number | null;
    edge: number | null;
  };
  overUnder: {
    line: string;
    over: number | null;
    under: number | null;
    odds: number;
    fairOdds: number | null;
    edge: number | null;
  };
  confidence: string;
  isLocked: boolean;
}

export default function MatchScanner() {
  const [tier, setTier] = useState<string>('FREE');
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [maxReveals, setMaxReveals] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Watchlist states
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [filterWatchlist, setFilterWatchlist] = useState(false);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [minEdge, setMinEdge] = useState('0');
  const [sortBy, setSortBy] = useState('edge');

  // Upgrade Modal Control
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [revealTarget, setRevealTarget] = useState<MatchPrediction | null>(null);

  // Fetch predictions from API
  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/predictions');
      const data = await res.json();
      if (data.success) {
        setPredictions(data.predictions || []);
        setRevealedCount(data.revealedCount || 0);
        setMaxReveals(data.maxReveals || 3);
      } else {
        setError(data.error || 'Failed to load predictions');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching predictions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedTier = localStorage.getItem('handicaplab_user_tier') || 'FREE';
    setTier(savedTier);

    fetchPredictions();

    try {
      const savedWatchlist = localStorage.getItem('handicaplab_watchlist');
      setWatchlist(savedWatchlist ? JSON.parse(savedWatchlist) : []);
    } catch {
      setWatchlist([]);
    }

    // Log return visit event
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'scanner_return_visit', metadata: { tier: savedTier } })
    }).catch(err => console.error(err));
  }, []);

  // Trigger reveal API
  const handleReveal = async (match: MatchPrediction) => {
    if (revealedCount >= maxReveals) {
      setShowUpgradeModal(true);
      // Log paywall shown event
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'paywall_shown', metadata: { reason: 'limit_reached', matchId: match.matchId } })
      }).catch(err => console.error(err));
      return;
    }

    try {
      const res = await fetch('/api/predictions/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: match.matchId })
      });
      const data = await res.json();
      if (data.success) {
        // Refetch predictions or merge revealed details
        await fetchPredictions();
        setRevealTarget(null);
      } else {
        alert(data.error || 'Reveal failed');
      }
    } catch (err) {
      console.error('Error revealing signal:', err);
    }
  };

  // List of distinct leagues
  const leagues = useMemo(() => {
    const set = new Set(predictions.map((p) => p.league));
    return ['all', ...Array.from(set)];
  }, [predictions]);

  // Filtered and Sorted Opportunities
  const filteredPredictions = useMemo(() => {
    let result = [...predictions];

    if (filterWatchlist) {
      result = result.filter((p) => watchlist.includes(p.matchId));
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (p) => p.match.toLowerCase().includes(term) || p.league.toLowerCase().includes(term)
      );
    }

    if (leagueFilter !== 'all') {
      result = result.filter((p) => p.league === leagueFilter);
    }

    const minEdgeVal = parseFloat(minEdge);
    if (minEdgeVal > 0) {
      result = result.filter((p) => {
        const ahEdge = p.asianHandicap?.edge || 0;
        const ouEdge = p.overUnder?.edge || 0;
        return ahEdge >= minEdgeVal || ouEdge >= minEdgeVal;
      });
    }

    // Sort opportunities
    result.sort((a, b) => {
      if (sortBy === 'edge') {
        const maxEdgeA = Math.max(a.asianHandicap?.edge || 0, a.overUnder?.edge || 0);
        const maxEdgeB = Math.max(b.asianHandicap?.edge || 0, b.overUnder?.edge || 0);
        return maxEdgeB - maxEdgeA;
      }
      if (sortBy === 'time') {
        return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
      }
      if (sortBy === 'odds') {
        const maxOddsA = Math.max(a.asianHandicap?.odds || 0, a.overUnder?.odds || 0);
        const maxOddsB = Math.max(b.asianHandicap?.odds || 0, b.overUnder?.odds || 0);
        return maxOddsB - maxOddsA;
      }
      return 0;
    });

    return result;
  }, [predictions, search, leagueFilter, minEdge, sortBy, watchlist, filterWatchlist]);

  const hasAdvancedAccess = tier !== 'FREE' && tier !== 'STARTER';

  return (
    <div className="space-y-6 text-slate-100">
      {/* Reveal Modal Confirmation */}
      {revealTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>👁</span> Reveal Predictive Details?
            </h3>
            <p className="text-slate-400 text-xs leading-normal">
              Revealing this match will consume 1 of your 3 daily unlocks. 
              <br />
              <strong className="text-emerald-400 mt-2 block">
                Daily reveals: {revealedCount} / {maxReveals} used
              </strong>
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleReveal(revealTarget)}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
              >
                Confirm Reveal
              </button>
              <button
                onClick={() => setRevealTarget(null)}
                className="flex-1 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold rounded-lg text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Paywall Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-emerald-500/20 p-8 rounded-2xl max-w-sm w-full text-center space-y-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <span>🔒</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Daily Reveals Capped</h3>
              <p className="text-slate-400 text-xs leading-normal">
                You have reached your limit of 3 full model reveals per day. Upgrade to a Pro or Founder subscription to unlock unlimited access.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/pricing" className="w-full">
                <button
                  onClick={() => {
                    fetch('/api/analytics', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventName: 'upgrade_clicked', metadata: { source: 'paywall_modal' } })
                    }).catch(err => console.error(err));
                    setShowUpgradeModal(false);
                  }}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Upgrade to Pro
                </button>
              </Link>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 font-semibold rounded-lg text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            Edge Detection Terminal
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1.5 font-sans">
            Edge Scanner Opportunities
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Convert real-time predictive probabilities into mathematical market opportunities. Sort and audit value edges.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterWatchlist(!filterWatchlist)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all ${
              filterWatchlist
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            ★ Watchlist Only ({watchlist.length})
          </button>

          {!hasAdvancedAccess && (
            <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded">
              📊 Daily Reveals Used: {revealedCount} / {maxReveals}
            </span>
          )}
        </div>
      </div>

      {/* Filter Control Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Search Teams</label>
            <Input
              type="text"
              placeholder="e.g. Liverpool"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500/30 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">League</label>
            <Select value={leagueFilter} onValueChange={(val) => setLeagueFilter(val || 'all')}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white focus:ring-emerald-500/30 text-xs">
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {leagues.map((league) => (
                  <SelectItem key={league} value={league} className="hover:bg-slate-850 focus:bg-slate-850 text-slate-350 text-xs">
                    {league === 'all' ? 'All Leagues' : league}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Minimum Model Edge</label>
            <Select value={minEdge} onValueChange={(val) => setMinEdge(val || '0')}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white focus:ring-emerald-500/30 text-xs">
                <SelectValue placeholder="Any Edge" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="0" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Any Edge (0%+)</SelectItem>
                <SelectItem value="3" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Value Edge (3%+)</SelectItem>
                <SelectItem value="5" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Strong Edge (5%+)</SelectItem>
                <SelectItem value="10" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Premium Edge (10%+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Sort Results By</label>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val || 'edge')}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white focus:ring-emerald-500/30 text-xs">
                <SelectValue placeholder="Edge %" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="edge" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Edge %</SelectItem>
                <SelectItem value="time" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Kickoff Time</SelectItem>
                <SelectItem value="odds" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Market Odds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Predictions Table */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 font-mono text-sm animate-pulse">
          Loading Scanner Feed...
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-400 font-mono text-sm">
          {error}
        </div>
      ) : (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden relative">
          <CardContent className="p-0">
            {filteredPredictions.length > 0 ? (
              <Table>
                <TableHeader className="border-b border-slate-800">
                  <TableRow className="hover:bg-transparent border-slate-800">
                    <TableHead className="text-slate-450 font-mono text-xs pl-6">Watch</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs">Fixture & League</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-center">Market Line</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-center">Market Odds</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-center">Fair Odds</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-center">Edge %</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-center">Confidence</TableHead>
                    <TableHead className="text-slate-450 font-mono text-xs text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPredictions.map((pred) => (
                    <TableRow key={pred.matchId} className="hover:bg-slate-850/40 border-slate-800/60">
                      <TableCell className="py-4 pl-6">
                        <WatchlistButton matchId={pred.matchId} />
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{pred.match}</span>
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5" suppressHydrationWarning>
                            {pred.league} • {new Date(pred.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center py-4 font-semibold text-slate-200">
                        <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-850">
                          {pred.asianHandicap?.line || 'N/A'}
                        </span>
                      </TableCell>

                      <TableCell className="text-center py-4 font-mono text-slate-300 font-bold">
                        {pred.asianHandicap?.odds?.toFixed(2) || 'N/A'}
                      </TableCell>

                      <TableCell className="text-center py-4 font-mono">
                        {!pred.isLocked ? (
                          <span className="text-slate-400">
                            {pred.asianHandicap?.fairOdds?.toFixed(2) || 'N/A'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                            🔒 Locked
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center py-4 font-mono">
                        {!pred.isLocked ? (
                          <Badge className={`font-bold ${pred.asianHandicap?.edge && pred.asianHandicap.edge > 7 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                            +{pred.asianHandicap?.edge?.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 font-bold">
                            🔒 Locked
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center py-4 font-mono">
                        <Badge className="font-bold bg-slate-950 text-slate-500 border-slate-800">
                          {pred.confidence || 'LOW'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right py-4 pr-6">
                        {pred.isLocked ? (
                          <button
                            onClick={() => setRevealTarget(pred)}
                            className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
                          >
                            Reveal Detail
                          </button>
                        ) : (
                          <Link href="/dashboard/paper-trading">
                            <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 font-mono text-xs transition-colors">
                              Trade
                            </button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-slate-500 space-y-2 font-mono text-xs">
                <div>No predictions available.</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
