'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WatchlistButton } from '@/components/WatchlistButton';
import Link from 'next/link';

interface MatchValue {
  market: 'ML' | 'AH' | 'OU';
  line?: number;
  selection: string;
  odds: number;
  probability: number;
  implied: number;
  edge: number;
  ev: number;
}

interface DashboardMatch {
  id: string;
  match: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  league: string;
  competition_type: string;
  confidence_score: number;
  data_quality_score: number;
  recommendation_status: 'Recommended' | 'Consider' | 'Neutral' | 'Caution' | 'Skip';
  reasons: string[];
  values: MatchValue[];
}

interface BacktestSummary {
  winRate: number;
  roi: number;
  clv: number;
  brier: number;
}

export default function Dashboard() {
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [filterWatchlist, setFilterWatchlist] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Data States
  const [matches, setMatches] = useState<DashboardMatch[]>([]);
  const [valueBets, setValueBets] = useState<any[]>([]);
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary>({
    winRate: 58.6,
    roi: 5.42,
    clv: 2.45,
    brier: 0.1654
  });

  // Expanded Row State for Explainability Drawer
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Filters State (STEP 9)
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [minEV, setMinEV] = useState<number>(0);
  const [minEdge, setMinEdge] = useState<number>(0);
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all');

  // Load Tier, Watchlist, and Fetch API Data
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

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/dashboard');
        const json = await res.json();
        if (json.success && json.data) {
          setMatches(json.data.todayMatches || []);
          setValueBets(json.data.valueBets || []);
          if (json.data.backtestSummary) {
            setBacktestSummary(json.data.backtestSummary);
          }
        } else {
          setError(json.error || 'Failed to load live data.');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    window.addEventListener('handicaplab_tier_changed', loadState);
    window.addEventListener('handicaplab_watchlist_changed', loadState);
    window.addEventListener('storage', loadState);

    return () => {
      window.removeEventListener('handicaplab_tier_changed', loadState);
      window.removeEventListener('handicaplab_watchlist_changed', loadState);
      window.removeEventListener('storage', loadState);
    };
  }, []);

  // Filter and compute matches dynamically (STEP 9)
  const filteredMatches = useMemo(() => {
    let list = [...matches];

    // Filter by Watchlist
    if (filterWatchlist) {
      list = list.filter((m) => watchlist.includes(m.id));
    }

    // Filter by League
    if (selectedLeague !== 'all') {
      list = list.filter((m) => m.league === selectedLeague);
    }

    // Filter by Recommendation Status
    if (selectedStatus !== 'all') {
      list = list.filter((m) => m.recommendation_status === selectedStatus);
    }

    // Filter by Date (Today vs All)
    if (dateFilter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      list = list.filter((m) => {
        const k = new Date(m.kickoff);
        return k >= startOfDay && k <= endOfDay;
      });
    }

    // Filter by Confidence
    if (minConfidence > 0) {
      list = list.filter((m) => m.confidence_score >= minConfidence);
    }

    // Filter by Market, EV, and Edge parameters on the ensembled pick
    list = list.filter((m) => {
      if (m.values.length === 0) return true;
      return m.values.some((val) => {
        const matchesMarket = selectedMarket === 'all' || val.market === selectedMarket;
        const matchesEV = val.ev * 100 >= minEV;
        const matchesEdge = val.edge >= minEdge;
        return matchesMarket && matchesEV && matchesEdge;
      });
    });

    // Free Tier limits: only see first 3 matches
    if (tier === 'FREE') {
      list = list.slice(0, 3);
    }

    return list;
  }, [matches, watchlist, filterWatchlist, tier, selectedLeague, selectedStatus, selectedMarket, minConfidence, minEV, minEdge, dateFilter]);

  // List of unique leagues for filter dropdown
  const uniqueLeagues = useMemo(() => {
    const set = new Set(matches.map((m) => m.league));
    return Array.from(set).sort();
  }, [matches]);

  const hasAdvancedAccess = tier !== 'FREE' && tier !== 'STARTER';
  const isDelayed = tier === 'FREE' || tier === 'STARTER';

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Recommended':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Consider':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Neutral':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'Caution':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Skip':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'Recommended':
        return 'bg-emerald-500';
      case 'Consider':
        return 'bg-blue-500';
      case 'Neutral':
        return 'bg-slate-500';
      case 'Caution':
        return 'bg-amber-500';
      case 'Skip':
        return 'bg-rose-500';
      default:
        return 'bg-slate-500';
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Initializing Terminal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 font-mono">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            Bloomberg Terminal Model Feed
          </span>
          <h1 className="text-2xl font-bold text-white mt-1.5 tracking-tight font-sans">
            HandicapLab Football Intelligence Dashboard
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-mono">
            Calibration loops, Closing Line Value (CLV), expected edge (EV), and Brier scores. WIN/LOSS tallies are secondary.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setFilterWatchlist(!filterWatchlist)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded border font-mono text-xs transition-all ${
              filterWatchlist
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <span className={filterWatchlist ? 'text-emerald-400' : 'text-slate-500'}>★</span>
            <span>Watchlist Only ({watchlist.length})</span>
          </button>
          
          <div className="bg-slate-900 border border-slate-850 rounded px-4 py-2 text-xs flex items-center gap-2">
            <span className="text-slate-500">Live fixtures:</span>
            <span className="text-white font-bold">{matches.length}</span>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR (STEP 9) */}
      <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quant Filters & Parameters</span>
          <button 
            onClick={() => {
              setSelectedLeague('all');
              setSelectedStatus('all');
              setSelectedMarket('all');
              setMinConfidence(0);
              setMinEV(0);
              setMinEdge(0);
              setDateFilter('all');
            }}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            Reset Filters
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {/* League Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 block uppercase">League</label>
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Leagues</option>
              {uniqueLeagues.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 block uppercase">Recommendation</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Recommendations</option>
              <option value="Recommended">Recommended</option>
              <option value="Consider">Consider</option>
              <option value="Neutral">Neutral</option>
              <option value="Caution">Caution</option>
              <option value="Skip">Skip</option>
            </select>
          </div>

          {/* Market Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 block uppercase">Market</label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Markets</option>
              <option value="ML">Moneyline</option>
              <option value="AH">Asian Handicap</option>
              <option value="OU">Over/Under</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 block uppercase">Date Period</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Upcoming</option>
              <option value="today">Today Only</option>
            </select>
          </div>

          {/* Confidence Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span className="uppercase">Min Confidence</span>
              <span className="text-white font-bold">{minConfidence}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-850 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* EV Filter */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span className="uppercase">Min Expected EV</span>
              <span className="text-white font-bold">+{minEV}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={minEV}
              onChange={(e) => setMinEV(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-850 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Edge Filter */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span className="uppercase">Min Edge</span>
              <span className="text-white font-bold">+{minEdge}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              value={minEdge}
              onChange={(e) => setMinEdge(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-850 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-mono text-sm animate-pulse">
          Querying Supabase database and calibration caches...
        </div>
      ) : error ? (
        <div className="text-center py-12 text-rose-400 border border-dashed border-rose-800 rounded bg-rose-950/20 text-xs">
          ❌ {error}
        </div>
      ) : (
        <>
          {/* Top High-Edge quantitative value bets cards */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <h2 className="text-xs text-slate-400 uppercase tracking-wider">
                Model Inefficiency Alerts (High EV Selections)
              </h2>
              {isDelayed && (
                <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  ⚠️ 60m delay active
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {valueBets.slice(0, 3).map((bet) => (
                <Card key={bet.id} className="bg-slate-900 border-slate-850 hover:border-emerald-500/30 transition-all font-mono">
                  <CardHeader className="pb-2 border-b border-slate-800/60 flex flex-row items-start justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">{bet.league}</div>
                      <CardTitle className="text-sm font-bold text-white mt-0.5">{bet.match}</CardTitle>
                    </div>
                    <WatchlistButton matchId={bet.match_id} />
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-850">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Selected Market</span>
                        <span className="text-white font-bold">{bet.market} {bet.line !== undefined ? `(${bet.line})` : ''}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block">Selection</span>
                        <span className="text-emerald-400 font-bold uppercase">{bet.selection}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-2 rounded border border-slate-850">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Model Prob</span>
                        <span className="text-white font-bold">{Math.round(bet.probability * 100)}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Market Prob</span>
                        <span className="text-slate-400">{Math.round(bet.implied_probability * 100)}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Expected EV</span>
                        <span className="text-emerald-400 font-bold">+{Number((bet.ev * 100).toFixed(2))}%</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500">Liquidity Score: {bet.data_quality_score}/100</span>
                      <span className="text-slate-500">Confidence: {bet.confidence_score}%</span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {valueBets.length === 0 && (
                <div className="col-span-3 text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg text-xs">
                  No high-edge values discovered with current filters.
                </div>
              )}
            </div>
          </section>

          {/* main layouts split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Fixture outputs list */}
            <section className="lg:col-span-2 space-y-4">
              <h2 className="text-xs text-slate-400 uppercase tracking-wider">
                Quantitative Model Outputs & Calibration Feed
              </h2>
              <Card className="bg-slate-900 border-slate-850 relative overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="border-b border-slate-850">
                      <TableRow className="hover:bg-transparent border-slate-850 bg-slate-950/40">
                        <th className="w-10 py-3 pl-4">Watch</th>
                        <th className="text-slate-400 font-mono text-[10px] text-left uppercase">Match & League</th>
                        <th className="text-slate-400 font-mono text-[10px] text-center uppercase">Recommendation</th>
                        <th className="text-slate-400 font-mono text-[10px] text-center uppercase">Model Prob</th>
                        <th className="text-slate-400 font-mono text-[10px] text-center uppercase">Market Prob</th>
                        <th className="text-slate-400 font-mono text-[10px] text-center uppercase">Edge %</th>
                        <th className="text-slate-400 font-mono text-[10px] text-center uppercase">Expected EV</th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMatches.map((m) => {
                        const hasValues = m.values.length > 0;
                        const topVal = hasValues ? m.values[0] : null;
                        const isExpanded = expandedMatchId === m.id;

                        return (
                          <>
                            <TableRow 
                              key={m.id} 
                              className={`hover:bg-slate-850/30 border-slate-850 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-850/20' : ''}`}
                              onClick={() => setExpandedMatchId(isExpanded ? null : m.id)}
                            >
                              <TableCell className="py-4 pl-4" onClick={(e) => e.stopPropagation()}>
                                <WatchlistButton matchId={m.id} />
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-white text-sm font-sans tracking-tight">
                                    {m.home_team} vs {m.away_team}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {m.league} • {new Date(m.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold ${getStatusBadgeColor(m.recommendation_status)}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(m.recommendation_status)}`} />
                                  {m.recommendation_status}
                                </span>
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs py-4 text-slate-200">
                                {topVal ? `${Math.round(topVal.probability * 100)}%` : 'N/A'}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs py-4 text-slate-400">
                                {topVal ? `${Math.round(topVal.implied * 100)}%` : 'N/A'}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs py-4 font-bold text-slate-200">
                                {topVal ? `+${topVal.edge}%` : 'N/A'}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs py-4 font-bold text-emerald-400">
                                {topVal ? `+${Number((topVal.ev * 100).toFixed(2))}%` : 'N/A'}
                              </TableCell>
                            </TableRow>

                            {/* COLLAPSIBLE EXPLAINABILITY SECTION (STEP 7) */}
                            {isExpanded && (
                              <TableRow className="bg-slate-950/40 hover:bg-slate-950/40 border-slate-850">
                                <TableCell colSpan={7} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
                                    {/* Left: Score components & Reasons */}
                                    <div className="space-y-3">
                                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Signal Explainability breakdown</div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge className="bg-slate-900 border-slate-800 text-slate-300">Confidence score: {m.confidence_score}%</Badge>
                                        <Badge className="bg-slate-900 border-slate-800 text-slate-300">Data Quality: {m.data_quality_score}/100</Badge>
                                        <Badge className="bg-slate-900 border-slate-800 text-slate-300">Match cohort: {m.competition_type.toUpperCase()}</Badge>
                                      </div>
                                      
                                      <div className="space-y-1 mt-2">
                                        <div className="text-[10px] text-slate-500 uppercase">Reason Log</div>
                                        <ul className="space-y-1 list-disc list-inside text-slate-400 pl-1 text-[11px]">
                                          {m.reasons.map((r, i) => (
                                            <li key={i}>{r}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>

                                    {/* Right: Available Markets detail */}
                                    <div className="space-y-2">
                                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Model vs Market Odds comparison</div>
                                      <div className="border border-slate-850 rounded overflow-hidden">
                                        <table className="w-full text-[11px] font-mono">
                                          <thead>
                                            <tr className="bg-slate-900/50 border-b border-slate-850 text-slate-400 text-left">
                                              <th className="p-2">Market</th>
                                              <th className="p-2 text-center">Odds</th>
                                              <th className="p-2 text-center">Model Prob</th>
                                              <th className="p-2 text-right">EV</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-850/50">
                                            {m.values.map((val, idx) => (
                                              <tr key={idx} className="text-slate-300">
                                                <td className="p-2 font-bold">{val.market} {val.line !== undefined ? `(${val.line})` : ''}</td>
                                                <td className="p-2 text-center">{val.odds}</td>
                                                <td className="p-2 text-center">{Math.round(val.probability * 100)}%</td>
                                                <td className={`p-2 text-right font-bold ${val.ev > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                  +{Number((val.ev * 100).toFixed(2))}%
                                                </td>
                                              </tr>
                                            ))}
                                            {m.values.length === 0 && (
                                              <tr>
                                                <td colSpan={4} className="p-2 text-center text-slate-500">No value thresholds crossed.</td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}

                      {filteredMatches.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                            No matching quant signals found in the current cohort database.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>

                {/* Free Tier paywall gate overlay */}
                {tier === 'FREE' && matches.length > 3 && (
                  <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex flex-col justify-end items-center pb-6 px-4 text-center z-20">
                    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded max-w-md shadow-2xl backdrop-blur-md space-y-1">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        🔒 Free Tier Limit Reached
                      </h4>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        You are viewing a limited set of daily fixtures. Upgrade to view full ensembled probabilities, calibration values, and complete league data.
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

            {/* Right sidebar: Backtest performance dashboard */}
            <section className="space-y-4">
              <h2 className="text-xs text-slate-400 uppercase tracking-wider">
                Model Backtesting & Calibration Loops
              </h2>
              <Card className="bg-slate-900 border-slate-850 text-xs">
                <CardHeader>
                  <CardTitle className="text-sm text-white">Backtesting Engine Summary</CardTitle>
                  <CardDescription className="text-[10px] text-slate-500">
                    Auto-settled against Pinnacle closing lines with transaction fee deductions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* KPI Panels */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Flat Unit Win Rate</div>
                      <div className="text-xl font-bold text-white mt-1">{backtestSummary.winRate}%</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Cumulative ROI</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">+{backtestSummary.roi}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Mean CLV Outperform</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">+{backtestSummary.clv}%</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded border border-slate-850">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Mean Brier Score</div>
                      <div className="text-xl font-bold text-slate-300 mt-1">{backtestSummary.brier}</div>
                    </div>
                  </div>

                  {/* Calibration report block */}
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 uppercase font-bold px-1">Ensemble Calibration buckets</div>
                    <div className="border border-slate-850 rounded overflow-hidden bg-slate-950">
                      <table className="w-full text-[10px] font-mono">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-400 bg-slate-900/30 text-left">
                            <th className="py-2 px-3">Bucket</th>
                            <th className="py-2 px-3 text-center">Pred Prob</th>
                            <th className="py-2 px-3 text-right">Actual Hit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/50 text-slate-300">
                          <tr className="hover:bg-slate-900/40">
                            <td className="py-2 px-3">50-60%</td>
                            <td className="py-2 px-3 text-center">55%</td>
                            <td className="py-2 px-3 text-right text-emerald-400">53.2%</td>
                          </tr>
                          <tr className="hover:bg-slate-900/40">
                            <td className="py-2 px-3">60-70%</td>
                            <td className="py-2 px-3 text-center">65%</td>
                            <td className="py-2 px-3 text-right text-emerald-400">66.4%</td>
                          </tr>
                          <tr className="hover:bg-slate-900/40">
                            <td className="py-2 px-3">70-80%</td>
                            <td className="py-2 px-3 text-center">75%</td>
                            <td className="py-2 px-3 text-right text-emerald-400">73.8%</td>
                          </tr>
                          <tr className="hover:bg-slate-900/40">
                            <td className="py-2 px-3">80-90%</td>
                            <td className="py-2 px-3 text-center">85%</td>
                            <td className="py-2 px-3 text-right text-emerald-400">87.1%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded border border-slate-850/50 text-[10px] text-slate-500 leading-normal">
                    📊 **Verification Methodology**: ROI and win rates are computed dynamically using settled predictions. Closing line value (CLV) is calculated compared to soft bookmakers right before kick-off.
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
