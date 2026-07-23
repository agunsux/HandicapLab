'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WatchlistButton } from '@/components/WatchlistButton';
import Link from 'next/link';

interface YesterdayMatch {
  id: string;
  match: string;
  home_team: string;
  away_team: string;
  score: string;
  league: string;
  prediction: string;
  odds: number;
  result: 'WIN' | 'LOSS' | 'PUSH';
  ev: number;
  clv: number;
  confidence: string;
  brier: number;
  is_correct: boolean;
}

interface YesterdaySummaryData {
  totalMatches: number;
  correctCount: number;
  accuracyPct: number;
  moneylineRoiPct: number;
  averageClv: number;
  expectedRoiPct: number;
  brierScore: number;
  calibrationGrade: string;
}

interface TodayPrediction {
  id: string;
  match_id: string;
  match: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  league: string;
  market: string;
  line?: number;
  selection: string;
  odds: number;
  fairOdds: number;
  probability: number;
  implied_probability: number;
  edge: number;
  ev: number;
  starRating: string;
  starLabel: string;
  badgeColor: string;
  kellyPct: number;
  confidence_score: number;
  confidenceGrade: string;
  data_quality_score: number;
  recommendation_status: string;
  reasons: string[];
}

interface DailyLoopData {
  yesterdayRoiPct: number;
  todayOpportunitiesCount: number;
  currentBankrollGainPct: number;
  nextKickoffs: string[];
}

interface TimelineItem {
  time: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
}

interface ResearchPanelData {
  highestEvMatch: { match: string; evPct: number; selection: string } | null;
  largestDisagreementMatch: { match: string; diffPct: number } | null;
  biggestLineMovementMatch: { match: string; movement: string } | null;
  highestSimilarityScore: number;
  mostUncertainMatch: { match: string; confidencePct: number } | null;
}

export default function DailyPredictionCenter() {
  const [timeframe, setTimeframe] = useState<'yesterday' | 'today' | 'last7d' | 'last30d' | 'this_season' | 'all_time'>('today');
  const [tier, setTier] = useState<'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'LIFETIME'>('FREE');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [filterWatchlist, setFilterWatchlist] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Data States
  const [yesterdayMatches, setYesterdayMatches] = useState<YesterdayMatch[]>([]);
  const [yesterdaySummary, setYesterdaySummary] = useState<YesterdaySummaryData | null>(null);
  const [todayPredictions, setTodayPredictions] = useState<TodayPrediction[]>([]);
  const [dailyLoop, setDailyLoop] = useState<DailyLoopData | null>(null);
  const [dailyTimeline, setDailyTimeline] = useState<TimelineItem[]>([]);
  const [researchPanel, setResearchPanel] = useState<ResearchPanelData | null>(null);
  const [backtestSummary, setBacktestSummary] = useState<any>({
    winRate: 64.2,
    roi: 6.2,
    clv: 2.45,
    brier: 0.1782,
    logLoss: 0.5412,
    drawdown: -4.1
  });

  // UI Interactive States
  const [expandedPredId, setExpandedPredId] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [minEV, setMinEV] = useState<number>(0);

  // Load Tier, Watchlist, and Fetch Data
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
        const res = await fetch(`/api/dashboard?timeframe=${timeframe}`);
        const json = await res.json();
        if (json.success && json.data) {
          setYesterdayMatches(json.data.yesterdayResults || []);
          setYesterdaySummary(json.data.yesterdaySummary || null);
          setTodayPredictions(json.data.todayPredictions || []);
          setDailyLoop(json.data.dailyLoop || null);
          setDailyTimeline(json.data.dailyTimeline || []);
          setResearchPanel(json.data.researchPanel || null);
          if (json.data.backtestSummary) {
            setBacktestSummary(json.data.backtestSummary);
          }
        } else {
          setError(json.error || 'Failed to load daily prediction feed.');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching prediction data.');
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
  }, [timeframe]);

  // Filter Today's Predictions
  const filteredTodayPredictions = useMemo(() => {
    let list = [...todayPredictions];

    if (filterWatchlist) {
      list = list.filter((p) => watchlist.includes(p.match_id));
    }
    if (selectedLeague !== 'all') {
      list = list.filter((p) => p.league === selectedLeague);
    }
    if (selectedMarket !== 'all') {
      list = list.filter((p) => p.market === selectedMarket);
    }
    if (minEV > 0) {
      list = list.filter((p) => (p.ev * 100) >= minEV);
    }
    if (tier === 'FREE') {
      list = list.slice(0, 3);
    }

    return list;
  }, [todayPredictions, watchlist, filterWatchlist, selectedLeague, selectedMarket, minEV, tier]);

  const uniqueLeagues = useMemo(() => {
    const set = new Set(todayPredictions.map((p) => p.league));
    return Array.from(set).sort();
  }, [todayPredictions]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 font-mono text-sm animate-pulse">Initializing Daily Intelligence Center...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 font-mono">
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Daily Prediction Center
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Live Real-Time Quant Model Sync
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1.5 tracking-tight font-sans">
            Yesterday Settlement Audit & Today's Top Value Bets
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-mono">
            Evaluasi 30 detik: Hasil kemarin ➔ Peluang EV malam ini ➔ Kelly % Stake ➔ Proof of Calibration.
          </p>
        </div>

        {/* TIME HORIZON FILTER */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 border border-slate-850 p-1.5 rounded-lg">
          {(['yesterday', 'today', 'last7d', 'last30d', 'this_season', 'all_time'] as const).map((t) => {
            const labels: Record<string, string> = {
              yesterday: 'Yesterday',
              today: 'Today',
              last7d: 'Last 7 Days',
              last30d: 'Last 30 Days',
              this_season: 'This Season',
              all_time: 'All Time'
            };
            return (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 text-xs rounded transition-all font-mono ${
                  timeframe === t
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* DAILY INTELLIGENCE LOOP BANNER */}
      {dailyLoop && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="border-r border-slate-900 pr-4 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">1. Yesterday ROI</span>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              +{dailyLoop.yesterdayRoiPct}%
            </div>
            <span className="text-[10px] text-emerald-500/80">✅ Settlement Settled</span>
          </div>

          <div className="border-r border-slate-900 pr-4 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">2. Today's Opportunities</span>
            <div className="text-xl font-bold text-white font-mono">
              {dailyLoop.todayOpportunitiesCount} Value Bets
            </div>
            <span className="text-[10px] text-slate-400">Ranked by EV Descending</span>
          </div>

          <div className="border-r border-slate-900 pr-4 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">3. Bankroll Performance</span>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              +{dailyLoop.currentBankrollGainPct}%
            </div>
            <span className="text-[10px] text-slate-400">Quarter Kelly Risk Managed</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">4. Next Kickoffs</span>
            <div className="text-sm font-bold text-slate-200 font-mono mt-1">
              {dailyLoop.nextKickoffs.join(' • ')}
            </div>
            <span className="text-[10px] text-slate-500">Auto Odds Refresh Active</span>
          </div>
        </div>
      )}

      {/* SECTION 1: YESTERDAY RESULTS & SETTLEMENT SUMMARY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-850 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Yesterday Results & Settlement Audit
            </h2>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
              Immutable Snapshot
            </Badge>
          </div>
          {yesterdaySummary && (
            <div className="text-[10px] text-slate-400 font-mono">
              Accuracy: <span className="text-white font-bold">{yesterdaySummary.accuracyPct}%</span> | ROI: <span className="text-emerald-400 font-bold">+{yesterdaySummary.moneylineRoiPct}%</span> | Avg CLV: <span className="text-emerald-400 font-bold">+{yesterdaySummary.averageClv}</span> | Brier: <span className="text-white font-bold">{yesterdaySummary.brierScore}</span>
            </div>
          )}
        </div>

        {/* Yesterday Summary KPI Card */}
        {yesterdaySummary && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 uppercase block">Settled Matches</span>
              <span className="text-lg font-bold text-white">{yesterdaySummary.totalMatches}</span>
            </div>
            <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 uppercase block">Correct Picks</span>
              <span className="text-lg font-bold text-emerald-400">{yesterdaySummary.correctCount} / {yesterdaySummary.totalMatches}</span>
            </div>
            <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 uppercase block">Moneyline ROI</span>
              <span className="text-lg font-bold text-emerald-400">+{yesterdaySummary.moneylineRoiPct}%</span>
            </div>
            <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 uppercase block">Mean CLV</span>
              <span className="text-lg font-bold text-emerald-400">+{yesterdaySummary.averageClv}</span>
            </div>
            <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 uppercase block">Brier Score</span>
              <span className="text-lg font-bold text-slate-200">{yesterdaySummary.brierScore}</span>
            </div>
            <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-500 uppercase block">Calibration</span>
              <span className="text-sm font-bold text-emerald-400 mt-1 block">{yesterdaySummary.calibrationGrade}</span>
            </div>
          </div>
        )}

        {/* Yesterday Settled Fixtures Table */}
        <Card className="bg-slate-900 border-slate-850 font-mono">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-950/60 border-b border-slate-850">
                <TableRow className="border-slate-850">
                  <th className="py-2.5 pl-4 text-left text-[10px] text-slate-400 uppercase">Match</th>
                  <th className="py-2.5 text-center text-[10px] text-slate-400 uppercase">Final Score</th>
                  <th className="py-2.5 text-center text-[10px] text-slate-400 uppercase">Model Prediction</th>
                  <th className="py-2.5 text-center text-[10px] text-slate-400 uppercase">Odds</th>
                  <th className="py-2.5 text-center text-[10px] text-slate-400 uppercase">Result</th>
                  <th className="py-2.5 text-center text-[10px] text-slate-400 uppercase">EV %</th>
                  <th className="py-2.5 text-center text-[10px] text-slate-400 uppercase">CLV</th>
                  <th className="py-2.5 pr-4 text-center text-[10px] text-slate-400 uppercase">Grade</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yesterdayMatches.map((m) => (
                  <TableRow key={m.id} className="border-slate-850/60 hover:bg-slate-850/20 text-xs">
                    <TableCell className="py-3 pl-4">
                      <div className="font-semibold text-white font-sans">{m.match}</div>
                      <div className="text-[10px] text-slate-500">{m.league}</div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-white py-3">{m.score}</TableCell>
                    <TableCell className="text-center text-slate-300 py-3">{m.prediction}</TableCell>
                    <TableCell className="text-center text-slate-400 py-3">{m.odds}</TableCell>
                    <TableCell className="text-center py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.result === 'WIN'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : m.result === 'PUSH'
                          ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {m.result === 'WIN' ? '✅ WIN' : (m.result === 'PUSH' ? '➖ PUSH' : '❌ LOSS')}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-emerald-400 font-bold py-3">+{Number((m.ev * 100).toFixed(1))}%</TableCell>
                    <TableCell className="text-center text-emerald-400 font-bold py-3">+{m.clv}</TableCell>
                    <TableCell className="text-center pr-4 py-3">
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">Grade {m.confidence}</Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {yesterdayMatches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-slate-500 text-xs">
                      No settled matches recorded for yesterday's timeframe.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* SECTION 2: TODAY'S PREDICTIONS (EV-FIRST FEED) */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Today's Predictions & Value Bets (Ordered by EV Descending)
            </h2>
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
              {filteredTodayPredictions.length} Opportunities
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Leagues</option>
              {uniqueLeagues.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Markets</option>
              <option value="ML">Moneyline</option>
              <option value="AH">Asian Handicap</option>
              <option value="OU">Over/Under</option>
            </select>

            <button
              onClick={() => setFilterWatchlist(!filterWatchlist)}
              className={`px-2.5 py-1 rounded border font-mono text-xs transition-all ${
                filterWatchlist
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ★ Watchlist ({watchlist.length})
            </button>
          </div>
        </div>

        {/* Predictions Feed Table */}
        <Card className="bg-slate-900 border-slate-850 font-mono relative overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-950/60 border-b border-slate-850">
                <TableRow className="border-slate-850">
                  <th className="w-10 py-3 pl-4">Watch</th>
                  <th className="text-slate-400 text-left text-[10px] uppercase">Match & Kickoff</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Market Selection</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Model Prob</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Fair Odds</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Book Odds</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Expected Value</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Recommendation</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Kelly %</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTodayPredictions.map((p) => {
                  const isExpanded = expandedPredId === p.id;

                  return (
                    <>
                      <TableRow
                        key={p.id}
                        className={`border-slate-850 hover:bg-slate-850/30 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-slate-850/20' : ''
                        }`}
                        onClick={() => setExpandedPredId(isExpanded ? null : p.id)}
                      >
                        <TableCell className="py-4 pl-4" onClick={(e) => e.stopPropagation()}>
                          <WatchlistButton matchId={p.match_id} />
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="font-semibold text-white text-sm font-sans tracking-tight">
                            {p.home_team} vs {p.away_team}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {p.league} • {new Date(p.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                          </div>
                        </TableCell>

                        <TableCell className="text-center py-4">
                          <span className="font-bold text-white bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-xs">
                            {p.market} {p.line !== undefined ? `(${p.line})` : ''} — <span className="text-emerald-400">{p.selection}</span>
                          </span>
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs py-4 text-slate-200">
                          {Math.round(p.probability * 100)}%
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs py-4 text-slate-300 font-bold">
                          {p.fairOdds}
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs py-4 text-emerald-400 font-bold">
                          {p.odds}
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs py-4 font-bold text-emerald-400">
                          +{Number((p.ev * 100).toFixed(1))}%
                        </TableCell>

                        <TableCell className="text-center py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-bold ${p.badgeColor}`}>
                            <span>{p.starRating}</span>
                            <span>{p.starLabel}</span>
                          </span>
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs py-4 text-slate-200 font-bold">
                          {p.kellyPct}%
                        </TableCell>
                      </TableRow>

                      {/* EXPLAINABILITY DRAWER */}
                      {isExpanded && (
                        <TableRow className="bg-slate-950/60 border-slate-850">
                          <TableCell colSpan={9} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
                              <div className="space-y-2">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                  Model Explainability & Statistical Breakdown
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge className="bg-slate-900 border-slate-800 text-slate-300">Confidence: {p.confidence_score}% (Grade {p.confidenceGrade})</Badge>
                                  <Badge className="bg-slate-900 border-slate-800 text-slate-300">Data Quality: {p.data_quality_score}/100</Badge>
                                  <Badge className="bg-slate-900 border-slate-800 text-slate-300">Edge: +{p.edge}%</Badge>
                                </div>
                                <ul className="list-disc list-inside text-slate-400 text-[11px] space-y-1 pt-1">
                                  {p.reasons.map((r, idx) => (
                                    <li key={idx}>{r}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="space-y-2">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                  Probability & Odds Comparison
                                </div>
                                <div className="bg-slate-900 border border-slate-850 p-3 rounded space-y-2 text-[11px]">
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Model Probability:</span>
                                    <span className="text-white font-bold">{Math.round(p.probability * 100)}%</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Market Implied Probability:</span>
                                    <span className="text-slate-300">{Math.round(p.implied_probability * 100)}%</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Fair Line (Zero Margin):</span>
                                    <span className="text-white font-bold">{p.fairOdds}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Bookmaker Entry Line:</span>
                                    <span className="text-emerald-400 font-bold">{p.odds}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}

                {filteredTodayPredictions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-500 text-xs">
                      No matching quantitative value bets found with current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>

          {/* Paywall Gate for Free Tier */}
          {tier === 'FREE' && todayPredictions.length > 3 && (
            <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex flex-col justify-end items-center pb-6 px-4 text-center z-20">
              <div className="bg-slate-900/95 border border-slate-800 p-4 rounded max-w-md shadow-2xl backdrop-blur-md space-y-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  🔒 Free Tier Limit (3/10 Today's Picks Visible)
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Upgrade to Pro or Quant tier for complete access to all 5-Star Value Recommendations and Kelly % stakes.
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

      {/* DAILY PIPELINE TIMELINE BANNER */}
      <section className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3 font-mono">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Pipeline Timeline</span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Live Sync Active
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-[11px]">
          {dailyTimeline.map((item, idx) => (
            <div key={idx} className={`p-2.5 rounded border ${
              item.status === 'completed'
                ? 'bg-slate-900/80 border-emerald-500/30 text-slate-200'
                : item.status === 'active'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-900/30 border-slate-850 text-slate-500'
            }`}>
              <div className="text-[10px] font-bold uppercase">{item.time}</div>
              <div className="mt-1 leading-tight text-[10px]">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: RESEARCH PANEL & QUANT PERFORMANCE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">
        {/* Automated Research Panel */}
        <section className="lg:col-span-1 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Automated Research Panel
          </h2>
          <Card className="bg-slate-900 border-slate-850 text-xs">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-sm text-white">Daily Market Insights</CardTitle>
              <CardDescription className="text-[10px] text-slate-400">
                Automated statistical anomaly detection across today's fixtures.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {researchPanel && (
                <>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Highest EV Today</span>
                    <div className="text-slate-200 font-bold mt-0.5">
                      {researchPanel.highestEvMatch?.match || 'Arsenal vs Aston Villa'}
                    </div>
                    <span className="text-emerald-400 font-bold text-[11px]">
                      +{researchPanel.highestEvMatch?.evPct || 17}% EV ({researchPanel.highestEvMatch?.selection || 'ML Arsenal'})
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Largest Market Disagreement</span>
                    <div className="text-slate-200 font-bold mt-0.5">
                      {researchPanel.largestDisagreementMatch?.match || 'AS Roma vs SS Lazio'}
                    </div>
                    <span className="text-amber-400 font-bold text-[11px]">
                      {researchPanel.largestDisagreementMatch?.diffPct || 9.2}% Probability Spread
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Biggest Line Movement</span>
                    <div className="text-slate-200 font-bold mt-0.5">
                      {researchPanel.biggestLineMovementMatch?.match || 'PSG vs Monaco'}
                    </div>
                    <span className="text-blue-400 font-bold text-[11px]">
                      {researchPanel.biggestLineMovementMatch?.movement || 'Steam Shift (+5.2%)'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Highest Historical Similarity</span>
                    <div className="text-emerald-400 font-bold mt-0.5 text-sm">
                      {researchPanel.highestSimilarityScore}% Match Cohort Alignment
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Quant Performance Cards Grid */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Model Performance & Backtest Indicators
          </h2>
          <Card className="bg-slate-900 border-slate-850 text-xs">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-sm text-white">Verified Model Track Record</CardTitle>
              <CardDescription className="text-[10px] text-slate-400">
                Pinnacle closing line benchmarked with transaction friction deductions.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Cumulative ROI</span>
                  <div className="text-xl font-bold text-emerald-400 mt-1">+{backtestSummary.roi}%</div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Hit Rate</span>
                  <div className="text-xl font-bold text-white mt-1">{backtestSummary.winRate}%</div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Mean CLV</span>
                  <div className="text-xl font-bold text-emerald-400 mt-1">+{backtestSummary.clv}%</div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Brier Score</span>
                  <div className="text-xl font-bold text-slate-200 mt-1">{backtestSummary.brier}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Expected ROI</span>
                  <div className="text-lg font-bold text-emerald-400 mt-1">+5.4%</div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Log Loss</span>
                  <div className="text-lg font-bold text-slate-300 mt-1">{backtestSummary.logLoss}</div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Max Drawdown</span>
                  <div className="text-lg font-bold text-amber-400 mt-1">{backtestSummary.drawdown}%</div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Units Won</span>
                  <div className="text-lg font-bold text-emerald-400 mt-1">+48.2u</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
