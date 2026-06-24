'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMatches, getPredictionsForMatch } from '@/lib/mock-data';
import { WatchlistButton } from '@/components/WatchlistButton';
import { EdgeScanner } from '@/lib/engines/edge-scanner';
import { ConfidenceScanner } from '@/lib/engines/edge-scanner/confidence';
import Link from 'next/link';

interface Opportunity {
  id: string;
  matchId: string;
  fixture: string;
  league: string;
  kickoffTime: Date;
  marketType: 'ML' | 'AH' | 'OU';
  marketName: string;
  selection: string;
  odds: number;
  fairOdds: number;
  edge: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  clv: number | null;
  tier: 'FREE' | 'PRO' | 'ELITE';
}

export default function MatchScanner() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [filterWatchlist, setFilterWatchlist] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Filter & Sort States
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [minEdge, setMinEdge] = useState('0'); // 0%, 3%, 5%, 10%
  const [sortBy, setSortBy] = useState('edge'); // 'edge', 'time', 'odds', 'confidence'

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

  // Leagues available in data
  const leagues = useMemo(() => {
    const set = new Set(allMatches.map((m) => m.league));
    return ['all', ...Array.from(set)];
  }, [allMatches]);

  // Convert raw predictions to flat market opportunities using EdgeScanner / models
  const opportunities = useMemo(() => {
    const list: Opportunity[] = [];
    
    allMatches.forEach((match) => {
      const pred = getPredictionsForMatch(match.id);
      if (!pred) return;

      const fixtureName = `${match.homeTeam?.name} vs ${match.awayTeam?.name}`;

      // 1. Asian Handicap Opportunity
      const ahProb = pred.handicapProbability;
      const ahOdds = pred.handicapMarketOdds;
      const ahFairOdds = pred.handicapFairOdds;
      const ahEdge = pred.handicapEdgePercent;
      
      list.push({
        id: `${match.id}-AH`,
        matchId: match.id,
        fixture: fixtureName,
        league: match.league,
        kickoffTime: match.kickoffTime,
        marketType: 'AH',
        marketName: `Asian Handicap ${pred.handicapLine > 0 ? `+${pred.handicapLine}` : pred.handicapLine}`,
        selection: match.homeTeam?.name || 'Home',
        odds: ahOdds,
        fairOdds: ahFairOdds,
        edge: ahEdge,
        confidence: ConfidenceScanner.getConfidence(ahProb),
        // Calculate mock CLV based on model edge
        clv: Number((ahEdge * 0.15 - 0.5).toFixed(2)),
        tier: ahEdge >= 10 ? 'PRO' : 'FREE'
      });

      // 2. Over/Under Opportunity
      const ouProb = pred.overProbability;
      const ouOdds = 1.91; // mock market odds for OU
      const ouFairOdds = Number((1 / ouProb).toFixed(2));
      const ouEdge = pred.ouEdgePercent;

      list.push({
        id: `${match.id}-OU`,
        matchId: match.id,
        fixture: fixtureName,
        league: match.league,
        kickoffTime: match.kickoffTime,
        marketType: 'OU',
        marketName: `Over/Under Goals ${pred.totalLine}`,
        selection: 'Over',
        odds: ouOdds,
        fairOdds: ouFairOdds,
        edge: ouEdge,
        confidence: ConfidenceScanner.getConfidence(ouProb),
        clv: Number((ouEdge * 0.12 - 0.2).toFixed(2)),
        tier: ouEdge >= 8 ? 'PRO' : 'FREE'
      });

      // 3. Moneyline Opportunity (if Home probability is high)
      if (pred.homeProbability > 0.45) {
        const mlOdds = Number((1.1 / pred.homeProbability).toFixed(2));
        const mlFairOdds = Number((1 / pred.homeProbability).toFixed(2));
        const mlEdge = Number(((mlOdds / mlFairOdds - 1) * 100).toFixed(1));
        
        list.push({
          id: `${match.id}-ML`,
          matchId: match.id,
          fixture: fixtureName,
          league: match.league,
          kickoffTime: match.kickoffTime,
          marketType: 'ML',
          marketName: 'Moneyline 1X2',
          selection: match.homeTeam?.name || 'Home Win',
          odds: mlOdds,
          fairOdds: mlFairOdds,
          edge: mlEdge,
          confidence: ConfidenceScanner.getConfidence(pred.homeProbability),
          clv: Number((mlEdge * 0.1 - 0.1).toFixed(2)),
          tier: 'PRO'
        });
      }
    });

    return list;
  }, [allMatches]);

  // Filtered & Sorted results
  const filteredOpportunities = useMemo(() => {
    let result = [...opportunities];

    // Watchlist filter
    if (filterWatchlist) {
      result = result.filter((o) => watchlist.includes(o.matchId));
    }

    // Search filter
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (o) => o.fixture.toLowerCase().includes(term) || o.marketName.toLowerCase().includes(term)
      );
    }

    // League filter
    if (leagueFilter !== 'all') {
      result = result.filter((o) => o.league === leagueFilter);
    }

    // Edge filter
    const edgeLimit = parseFloat(minEdge);
    if (edgeLimit > 0) {
      result = result.filter((o) => o.edge >= edgeLimit);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'edge') {
        return b.edge - a.edge;
      }
      if (sortBy === 'time') {
        return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
      }
      if (sortBy === 'odds') {
        return b.odds - a.odds;
      }
      if (sortBy === 'confidence') {
        const confVal = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return confVal[b.confidence] - confVal[a.confidence];
      }
      return 0;
    });

    // Free Tier limits: only see top 2 opportunities
    if (tier === 'FREE') {
      result = result.slice(0, 2);
    }

    return result;
  }, [opportunities, search, leagueFilter, minEdge, sortBy, watchlist, filterWatchlist, tier]);

  const hasAdvancedAccess = tier !== 'FREE' && tier !== 'STARTER';
  const isDelayed = tier === 'FREE' || tier === 'STARTER';

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Initializing Scanner...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
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

          {isDelayed && (
            <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded">
              ⚠️ Delayed Feed
            </span>
          )}
        </div>
      </div>

      {/* Filter Control Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
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

          {/* League Filter */}
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

          {/* Min Edge Filter */}
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

          {/* Sort By */}
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
                <SelectItem value="confidence" className="hover:bg-slate-850 focus:bg-slate-850 text-xs">Confidence Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scanner List table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden relative">
        <CardContent className="p-0">
          {filteredOpportunities.length > 0 ? (
            <Table>
              <TableHeader className="border-b border-slate-800">
                <TableRow className="hover:bg-transparent border-slate-800">
                  <TableHead className="text-slate-450 font-mono text-xs pl-6">Watch</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs">Fixture & League</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Market Opportunity</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Market Odds</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Fair Odds</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Edge %</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">Confidence</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-center">CLV Expectation</TableHead>
                  <TableHead className="text-slate-450 font-mono text-xs text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOpportunities.map((op) => (
                  <TableRow key={op.id} className="hover:bg-slate-850/40 border-slate-800/60">
                    {/* Watchlist toggle */}
                    <TableCell className="py-4 pl-6">
                      <WatchlistButton matchId={op.matchId} />
                    </TableCell>

                    {/* Fixture */}
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{op.fixture}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5" suppressHydrationWarning>
                          {op.league} • {new Date(op.kickoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </TableCell>

                    {/* Market Opportunity */}
                    <TableCell className="text-center py-4 font-semibold text-slate-200">
                      <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-850">
                        {op.marketName} ({op.selection})
                      </span>
                    </TableCell>

                    {/* Market Odds */}
                    <TableCell className="text-center py-4 font-mono text-slate-300 font-bold">
                      {op.odds.toFixed(2)}
                    </TableCell>

                    {/* Fair Odds */}
                    <TableCell className="text-center py-4 font-mono">
                      {hasAdvancedAccess ? (
                        <span className="text-slate-400">{op.fairOdds.toFixed(2)}</span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                          🔒 Pro
                        </span>
                      )}
                    </TableCell>

                    {/* Edge % */}
                    <TableCell className="text-center py-4 font-mono">
                      {hasAdvancedAccess ? (
                        <Badge className={`font-bold ${op.edge > 7 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                          +{op.edge.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 font-bold">
                          🔒 Pro
                        </span>
                      )}
                    </TableCell>

                    {/* Confidence */}
                    <TableCell className="text-center py-4 font-mono">
                      <Badge className={`font-bold ${op.confidence === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : op.confidence === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                        {op.confidence}
                      </Badge>
                    </TableCell>

                    {/* CLV expectation */}
                    <TableCell className="text-center py-4 font-mono">
                      {hasAdvancedAccess ? (
                        <span className={`font-bold ${op.clv && op.clv > 0 ? 'text-emerald-450' : 'text-slate-400'}`}>
                          {op.clv && op.clv > 0 ? `+${op.clv}%` : op.clv ? `${op.clv}%` : '0.0%'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                          🔒 Pro
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right py-4 pr-6">
                      <Link href="/dashboard/paper-trading">
                        <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 font-mono text-xs transition-colors">
                          Trade
                        </button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-slate-500 space-y-2 font-mono text-xs">
              <div>No market opportunities identified with current filters.</div>
              <button
                onClick={() => {
                  setSearch('');
                  setLeagueFilter('all');
                  setMinEdge('0');
                  setSortBy('edge');
                  setFilterWatchlist(false);
                }}
                className="text-emerald-400 underline"
              >
                Reset Scanner Filters
              </button>
            </div>
          )}
        </CardContent>

        {/* Free plan blocking overlay */}
        {tier === 'FREE' && opportunities.length > 2 && (
          <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent flex flex-col justify-end items-center pb-6 px-4 text-center z-20">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl max-w-lg shadow-2xl backdrop-blur-md space-y-2">
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2">
                <span>🔒</span> Full Edge Scanner Restricted
              </h4>
              <p className="text-[11px] text-slate-400 leading-normal">
                Free members can only access the top 2 mock value opportunities. Upgrade to Pro/Quant to unlock the entire scanner, live CLV predictions, and advanced bankroll calculators.
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
    </div>
  );
}
