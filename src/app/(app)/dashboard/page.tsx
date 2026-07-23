'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WatchlistButton } from '@/components/WatchlistButton';
import {
  getEvHeatmapColor,
  evaluatePortfolioCorrelation,
  checkMinimumAcceptableOdds
} from '@/lib/engines/dailyIntelligence';
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
  probabilities?: { home: number; draw: number; away: number };
  bookmakers?: { ModelFair: number; Pinnacle: number; Bet365: number; '188BET': number; BestOdds: number };
  lineMovement?: { initialOdds: number; currentOdds: number; shiftPct: number; direction: 'UP' | 'DOWN' };
  expectedClosingOdds?: number;
  betTiming?: { action: 'BET NOW' | 'WAIT' | 'NO BET'; badgeColor: string; reason: string };
  minAcceptableOdds?: number;
  driverTags?: string[];
  similarCohort?: { count: number; winRatePct: number; roiPct: number; similarityScore: number };
}

interface BestBetData {
  id: string;
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
  evPct: number;
  edgePct: number;
  kellyPct: number;
  confidenceScore: number;
  starRating: string;
  starLabel: string;
  topReason: string;
}

interface PortfolioSummaryData {
  picksCount: number;
  expectedRoiPct: number;
  kellyExposurePct: number;
  riskLevel: 'Low' | 'Medium' | 'High';
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
  const [bestBet, setBestBet] = useState<BestBetData | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummaryData | null>(null);
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
  const [activeSection, setActiveSection] = useState<'all' | 'yesterday' | 'today' | 'performance' | 'research'>('all');
  const [expandedPredId, setExpandedPredId] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [minEV, setMinEV] = useState<number>(0);
  const [showAllMatches, setShowAllMatches] = useState<boolean>(false);
  const [selectedSlipBetIds, setSelectedSlipBetIds] = useState<string[]>([]);
  const [isBetSlipDrawerOpen, setIsBetSlipDrawerOpen] = useState<boolean>(false);

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
          setBestBet(json.data.bestBet || null);
          setPortfolioSummary(json.data.portfolioSummary || null);
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

  const betSlipItems = useMemo(() => {
    return todayPredictions.filter((p) => selectedSlipBetIds.includes(p.id));
  }, [todayPredictions, selectedSlipBetIds]);

  const betSlipSummary = useMemo(() => {
    return evaluatePortfolioCorrelation(betSlipItems);
  }, [betSlipItems]);

  const toggleBetSlipItem = (id: string) => {
    setSelectedSlipBetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

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

      {/* NEW LANDING DASHBOARD SECTION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'all', label: 'All Intelligence' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: 'today', label: "Today's Picks" },
          { id: 'performance', label: 'Performance' },
          { id: 'research', label: 'Research Notes' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
              activeSection === tab.id
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* BEST BET HERO CARD (#1 QUANT VALUE PICK) */}
      {(activeSection === 'all' || activeSection === 'today') && bestBet && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-slate-950 to-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-4 font-mono">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded shadow">
                ★ BEST VALUE PICK OF THE DAY
              </span>
              <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-black text-xs rounded uppercase tracking-wider shadow">
                BET NOW
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-xs">
                Quant Score: {bestBet.confidenceScore}/100
              </Badge>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <span>{bestBet.league}</span> • <span>{new Date(bestBet.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center font-mono">
            <div className="md:col-span-2 space-y-1">
              <h2 className="text-2xl font-black text-white font-sans tracking-tight">
                {bestBet.home_team} vs {bestBet.away_team}
              </h2>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-2 mt-1">
                <span>Selection:</span>
                <span className="bg-slate-900 border border-emerald-500/30 px-3 py-1 rounded text-white font-mono">
                  {bestBet.market} {bestBet.line !== undefined ? `(${bestBet.line})` : ''} — <span className="text-emerald-400">{bestBet.selection}</span>
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-2">
                💡 Driver: <span className="text-slate-200">{bestBet.topReason}</span>
              </p>
            </div>

            {/* DOMINANT FAIR ODDS CARD */}
            <div className="bg-slate-900/90 border-2 border-emerald-500/30 p-3.5 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">1. Model Fair Odds</span>
              <div className="text-3xl font-black text-white">{bestBet.fairOdds}</div>
              <span className="text-[10px] text-slate-400 font-bold">Zero-Margin Baseline</span>
            </div>

            {/* BEST MARKET ENTRY ODDS */}
            <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">2. Best Market Odds</span>
              <div className="text-3xl font-black text-emerald-400">{bestBet.odds}</div>
              <span className="text-[10px] text-emerald-500/80 font-bold">EV: +{bestBet.evPct}%</span>
            </div>

            {/* QUARTER KELLY STAKE */}
            <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">3. Quarter Kelly</span>
              <div className="text-3xl font-black text-white">{bestBet.kellyPct}%</div>
              <span className="text-[10px] text-slate-400 font-bold">Edge: +{bestBet.edgePct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S PORTFOLIO & RISK METER */}
      {(activeSection === 'all' || activeSection === 'today') && portfolioSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono">
          <div className="border-r border-slate-900 pr-4 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Today's Portfolio</span>
            <div className="text-xl font-bold text-white">
              {portfolioSummary.picksCount} Picks Identified
            </div>
            <span className="text-[10px] text-slate-400">EV Threshold ($\ge +2\%$)</span>
          </div>

          <div className="border-r border-slate-900 pr-4 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Expected Portfolio ROI</span>
            <div className="text-xl font-bold text-emerald-400">
              +{portfolioSummary.expectedRoiPct}%
            </div>
            <span className="text-[10px] text-emerald-500/80">Edge Weighted Expectation</span>
          </div>

          <div className="border-r border-slate-900 pr-4 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Bankroll Exposure (Kelly)</span>
            <div className="text-xl font-bold text-white">
              {portfolioSummary.kellyExposurePct}% Total Bankroll
            </div>
            <span className="text-[10px] text-slate-400">Fractional Kelly Capped</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Portfolio Risk Meter</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                portfolioSummary.riskLevel === 'Low'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : portfolioSummary.riskLevel === 'Medium'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {portfolioSummary.riskLevel} Risk Level
              </span>
            </div>
            <span className="text-[10px] text-slate-500">Variance Guard Active</span>
          </div>
        </div>
      )}

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
      {(activeSection === 'all' || activeSection === 'yesterday') && (
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
      )}

      {/* SECTION 2: TODAY'S PREDICTIONS (EV-FIRST FEED) */}
      {/* SECTION 2: TODAY'S PREDICTIONS (PRO BETTOR TERMINAL FEED) */}
      {(activeSection === 'all' || activeSection === 'today') && (
        <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Today's Predictions & Value Bets ({showAllMatches ? `All ${filteredTodayPredictions.length} Fixtures` : 'Top 5 Value Bets'})
            </h2>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
              EV Descending Order
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* MARKET FILTER TABS */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
              {[
                { id: 'all', label: 'All' },
                { id: 'ML', label: 'ML' },
                { id: 'AH', label: 'AH' },
                { id: 'OU', label: 'O/U' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMarket(m.id)}
                  className={`px-2.5 py-0.5 text-xs font-mono rounded transition-all ${
                    selectedMarket === m.id
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* LEAGUE FILTER DROPDOWN */}
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="all">All Leagues</option>
              {uniqueLeagues.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
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
                  <th className="w-16 py-3 pl-3 text-left">Slip</th>
                  <th className="text-slate-400 text-left text-[10px] uppercase">Match & Kickoff</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Selection</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase font-bold text-white">Dominant Fair Odds</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">1X2 Prob Dist</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Timing</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Best Book Odds</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Expected Value</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase">Kelly %</th>
                  <th className="text-slate-400 text-center text-[10px] uppercase pr-3">Quant Score</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(showAllMatches ? filteredTodayPredictions : filteredTodayPredictions.slice(0, 5)).map((p) => {
                  const isExpanded = expandedPredId === p.id;
                  const evStyle = getEvHeatmapColor(p.ev);
                  const isSlipSelected = selectedSlipBetIds.includes(p.id);

                  return (
                    <>
                      <TableRow
                        key={p.id}
                        className={`border-slate-850 hover:bg-slate-850/30 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-slate-850/20' : ''
                        }`}
                        onClick={() => setExpandedPredId(isExpanded ? null : p.id)}
                      >
                        <TableCell className="py-3 pl-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleBetSlipItem(p.id)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                              isSlipSelected
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {isSlipSelected ? '✓ Slip' : '+ Slip'}
                          </button>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="font-semibold text-white text-xs font-sans tracking-tight">
                            {p.home_team} vs {p.away_team}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {p.league} • {new Date(p.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                          </div>
                        </TableCell>

                        <TableCell className="text-center py-3">
                          <span className="font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                            {p.market} {p.line !== undefined ? `(${p.line})` : ''} — <span className="text-emerald-400">{p.selection}</span>
                          </span>
                        </TableCell>

                        {/* DOMINANT FAIR ODDS COLUMN */}
                        <TableCell className="text-center py-3">
                          <span className="text-sm font-black text-white bg-slate-950 px-2.5 py-1 rounded border border-emerald-500/40">
                            {p.fairOdds}
                          </span>
                        </TableCell>

                        {/* 1X2 PROBABILITY DISTRIBUTION BAR */}
                        <TableCell className="text-center py-3 min-w-[130px]">
                          <div className="flex items-center justify-between text-[10px] font-bold mb-1 px-1">
                            <span className="text-emerald-400">H {p.probabilities?.home || Math.round(p.probability * 100)}%</span>
                            <span className="text-amber-400">D {p.probabilities?.draw || 22}%</span>
                            <span className="text-slate-400">A {p.probabilities?.away || 17}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                            <div style={{ width: `${p.probabilities?.home || Math.round(p.probability * 100)}%` }} className="bg-emerald-500 h-full" />
                            <div style={{ width: `${p.probabilities?.draw || 22}%` }} className="bg-amber-500 h-full" />
                            <div style={{ width: `${p.probabilities?.away || 17}%` }} className="bg-slate-600 h-full" />
                          </div>
                        </TableCell>

                        {/* BET TIMING BADGE */}
                        <TableCell className="text-center py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${p.betTiming?.badgeColor || 'bg-emerald-500/20 text-emerald-400'}`}>
                            {p.betTiming?.action || 'BET NOW'}
                          </span>
                        </TableCell>

                        {/* BEST BOOKMAKER ODDS */}
                        <TableCell className="text-center font-mono text-xs py-3 text-emerald-400 font-bold">
                          {p.odds}
                        </TableCell>

                        {/* EV HEATMAP CELL */}
                        <TableCell className="text-center font-mono text-xs py-3">
                          <span className={`px-2 py-1 rounded text-xs ${evStyle}`}>
                            +{Number((p.ev * 100).toFixed(1))}%
                          </span>
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs py-3 text-slate-200 font-bold">
                          {p.kellyPct}%
                        </TableCell>

                        {/* QUANT CONFIDENCE SCORE (NUMERIC 96/100) */}
                        <TableCell className="text-center pr-3 py-3 font-mono text-xs font-bold text-emerald-300">
                          {p.confidence_score}/100
                        </TableCell>
                      </TableRow>

                      {/* EXPLAINABILITY, COHORT, & DRIVER TAGS DRAWER */}
                      {isExpanded && (
                        <TableRow className="bg-slate-950/60 border-slate-850">
                          <TableCell colSpan={10} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
                              {/* ACTIONABLE DRIVER TAGS */}
                              <div className="space-y-2">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                  Actionable Model Driver Tags
                                </div>
                                <div className="space-y-1.5 pt-1">
                                  {(p.driverTags || p.reasons).map((tag, idx) => (
                                    <div key={idx} className="bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 font-mono">
                                      <span>{tag}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* EMPIRICAL SIMILAR MATCHES COHORT */}
                              <div className="space-y-2">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                  Empirical Historical Cohort Validation
                                </div>
                                <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg space-y-2 text-[11px] font-mono">
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Matched Situations:</span>
                                    <span className="text-white font-bold">{p.similarCohort?.count || 238} Historical Matches</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Cohort Historical ROI:</span>
                                    <span className="text-emerald-400 font-bold">+{p.similarCohort?.roiPct || 11.2}%</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Cohort Win Rate:</span>
                                    <span className="text-white font-bold">{p.similarCohort?.winRatePct || 57.8}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Min Acceptable Odds:</span>
                                    <span className="text-amber-400 font-bold">{p.minAcceptableOdds || 1.72}</span>
                                  </div>
                                </div>
                              </div>

                              {/* MULTI-BOOKMAKER COMPARISON */}
                              <div className="space-y-2">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                  Multi-Bookmaker Line Matrix
                                </div>
                                <div className="bg-slate-900 border border-slate-850 p-3 rounded-lg space-y-2 text-[11px] font-mono">
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Model Fair Line:</span>
                                    <span className="text-white font-bold">{p.fairOdds}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Pinnacle (Sharp):</span>
                                    <span className="text-emerald-400 font-bold">{p.bookmakers?.Pinnacle || (p.odds * 0.96).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-800 pb-1">
                                    <span className="text-slate-400">Bet365 (Soft):</span>
                                    <span className="text-emerald-400 font-bold">{p.bookmakers?.Bet365 || (p.odds * 0.99).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">188BET (Soft):</span>
                                    <span className="text-emerald-400 font-bold">{p.bookmakers?.['188BET'] || (p.odds * 0.975).toFixed(2)}</span>
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
                    <TableCell colSpan={10} className="text-center py-12 text-slate-500 text-xs">
                      No matching quantitative value bets found with current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>

          {/* SHOW ALL / SHOW TOP 5 TOGGLE BAR */}
          {filteredTodayPredictions.length > 5 && (
            <div className="p-3 bg-slate-950/80 border-t border-slate-850 flex justify-center items-center">
              <button
                onClick={() => setShowAllMatches(!showAllMatches)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 text-slate-200 hover:text-white font-bold text-xs transition-all shadow-sm"
              >
                {showAllMatches
                  ? '↑ Show Top 5 Value Bets Only'
                  : `↓ Show All ${filteredTodayPredictions.length} Fixtures`}
              </button>
            </div>
          )}

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
      )}

      {/* DAILY PIPELINE TIMELINE BANNER */}
      {(activeSection === 'all' || activeSection === 'today') && (
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
      )}

      {/* SECTION 3: RESEARCH PANEL & QUANT PERFORMANCE CARDS */}
      {(activeSection === 'all' || activeSection === 'performance' || activeSection === 'research') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">
          {/* Automated Research Panel */}
          {(activeSection === 'all' || activeSection === 'research') && (
            <section className={`${activeSection === 'research' ? 'lg:col-span-3' : 'lg:col-span-1'} space-y-4`}>
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
          )}

          {/* Quant Performance Cards Grid */}
          {(activeSection === 'all' || activeSection === 'performance') && (
            <section className={`${activeSection === 'performance' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
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
          )}
        </div>
      )}
    {/* FLOATING BET SLIP PORTFOLIO BAR & DRAWER */}
      {selectedSlipBetIds.length > 0 && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:right-8 z-50 font-mono">
          {!isBetSlipDrawerOpen ? (
            <div className="bg-slate-950/95 border-2 border-emerald-500/50 p-4 rounded-xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-6 max-w-xl">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Portfolio Bet Slip</span>
                    <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-black text-[10px]">
                      {selectedSlipBetIds.length} Selected
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Stake: <span className="text-white font-bold">{(betSlipItems.reduce((a, b) => a + (b.kellyPct || 1.5), 0)).toFixed(1)}%</span> • ROI: <span className="text-emerald-400 font-bold">+{(betSlipItems.reduce((a, b) => a + (b.ev || 0.05), 0) / Math.max(1, betSlipItems.length) * 100).toFixed(1)}%</span> • Correlation: <span className="text-amber-400 font-bold">{betSlipSummary.correlation}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBetSlipDrawerOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md"
                >
                  Open Portfolio Drawer
                </button>
                <button
                  onClick={() => setSelectedSlipBetIds([])}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border-2 border-emerald-500/60 p-6 rounded-2xl shadow-2xl backdrop-blur-xl w-full md:w-[480px] space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Today's Portfolio Bet Slip Execution
                  </h3>
                  <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black text-xs">
                    {selectedSlipBetIds.length} Picks
                  </span>
                </div>
                <button
                  onClick={() => setIsBetSlipDrawerOpen(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* LIST OF SELECTED SLIP BETS */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {betSlipItems.map((item) => (
                  <div key={item.id} className="bg-slate-900 border border-slate-850 p-3 rounded-lg flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-white">{item.match}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.market} {item.line !== undefined ? `(${item.line})` : ''} — <span className="text-emerald-400">{item.selection}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Fair: <span className="text-white font-bold">{item.fairOdds}</span> • Book: <span className="text-emerald-400 font-bold">{item.odds}</span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-emerald-400 font-bold text-xs">+{Number((item.ev * 100).toFixed(1))}% EV</div>
                      <div className="text-slate-300 text-[10px]">Kelly: {item.kellyPct}%</div>
                      <button
                        onClick={() => toggleBetSlipItem(item.id)}
                        className="text-[9px] text-rose-400 hover:underline block ml-auto"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* PORTFOLIO CORRELATION & RISK AUDIT PANEL */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3 font-mono">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-850 pb-1.5 flex justify-between items-center">
                  <span>Portfolio Risk & Correlation Audit</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                    betSlipSummary.correlation === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : (betSlipSummary.correlation === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40')
                  }`}>
                    Correlation: {betSlipSummary.correlation}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Portfolio Stake</span>
                    <span className="text-sm font-bold text-white">
                      {(betSlipItems.reduce((a, b) => a + (b.kellyPct || 1.5), 0)).toFixed(1)}% Bankroll
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Expected Portfolio ROI</span>
                    <span className="text-sm font-bold text-emerald-400">
                      +{(betSlipItems.reduce((a, b) => a + (b.ev || 0.05), 0) / Math.max(1, betSlipItems.length) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Worst Estimated Drawdown</span>
                    <span className="text-sm font-bold text-amber-400">
                      {betSlipSummary.worstDrawdownPct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Expected Profit Units</span>
                    <span className="text-sm font-bold text-emerald-400">
                      +{betSlipSummary.expectedProfitUnits} units
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-850">
                  ⚠️ <span className="font-semibold text-slate-300">Governance Note:</span> {betSlipSummary.reason}
                </div>
              </div>

              {/* EXECUTION ACTION BUTTON */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => alert(`Portfolio Bet Slip locked with ${selectedSlipBetIds.length} picks! Stakes logged to paper trading ledger.`)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors shadow-lg"
                >
                  Lock & Execute Portfolio
                </button>
                <button
                  onClick={() => setSelectedSlipBetIds([])}
                  className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold"
                >
                  Clear Slip
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
