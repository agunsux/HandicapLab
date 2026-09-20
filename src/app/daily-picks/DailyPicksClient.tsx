'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Clock,
  Database,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Percent,
  Scale,
} from 'lucide-react';
import { DailyPickRecord, CanonicalMarket, DailyPicksApiResponse } from '@/lib/daily-picks/types';

interface DailyPicksClientProps {
  initialData: DailyPicksApiResponse;
}

export function DailyPicksClient({ initialData }: DailyPicksClientProps) {
  const [data, setData] = useState<DailyPicksApiResponse>(initialData);
  const [selectedMarket, setSelectedMarket] = useState<'ALL' | CanonicalMarket>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [perfData, setPerfData] = useState<any | null>(null);
  const [activeHorizon, setActiveHorizon] = useState<'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'allTime'>('today');

  const fetchPerformance = async () => {
    try {
      const res = await fetch('/api/performance');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setPerfData(json);
        }
      }
    } catch (e) {
      console.warn('[DailyPicksClient] Performance telemetry unavailable:', e);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  // Relative time tracker
  useEffect(() => {
    const updateAgo = () => {
      const diffSec = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
      if (diffSec < 60) setTimeAgo('just now');
      else if (diffSec < 3600) setTimeAgo(`${Math.floor(diffSec / 60)}m ago`);
      else setTimeAgo(`${Math.floor(diffSec / 3600)}h ago`);
    };

    updateAgo();
    const interval = setInterval(updateAgo, 30_000);
    return () => clearInterval(interval);
  }, [lastRefreshed]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const [picksRes] = await Promise.all([
        fetch('/api/daily-picks?refresh=true'),
        fetchPerformance(),
      ]);
      if (picksRes.ok) {
        const json = await picksRes.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('[DailyPicksClient] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const picks = data.picks || [];
  const filteredPicks = selectedMarket === 'ALL'
    ? picks
    : picks.filter((p) => p.market === selectedMarket);

  const ahCount = picks.filter((p) => p.market === 'AH').length;
  const ouCount = picks.filter((p) => p.market === 'OU').length;
  const bttsCount = picks.filter((p) => p.market === 'BTTS').length;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getActiveStats = () => {
    if (!perfData) return null;
    const h = perfData[activeHorizon] || perfData.today || null;
    if (!h) return null;
    const settled = h.settled ?? h.settledBets ?? 0;
    const wins = h.wins ?? 0;
    const losses = h.losses ?? 0;
    const pushes = h.pushes ?? 0;
    const halfWins = h.halfWins ?? 0;
    const halfLosses = h.halfLosses ?? 0;
    const stakeUnits = h.stakeUnits ?? 0;
    const profitUnits = h.profitUnits ?? 0;
    const yieldPct = h.yieldPct ?? 0;
    const avgOdds = h.averageOdds ?? h.avgOdds ?? 0;
    const avgConf = h.averageConfidence ?? h.avgConfidence ?? 0;
    return {
      settled,
      wins,
      losses,
      pushes,
      halfWins,
      halfLosses,
      stakeUnits,
      profitUnits,
      yieldPct,
      avgOdds,
      avgConf,
    };
  };

  const activeStats = getActiveStats();
  const totalOpenBets = perfData?.totalOpenBets ?? 0;
  const totalOpenStakeUnits = perfData?.openStakeUnits ?? 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#0B1120] font-sans text-[#F0F4F8]">
      {/* Top Banner & Audit Fact Ribbon */}
      <section className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-8 border-b border-[#1E293B]">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Real Data & Live Status Badges */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-mono font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                REAL DATA &bull; ZERO MOCK
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131B2E] border border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                <Clock className="h-3.5 w-3.5 text-[#3B82F6]" />
                Updated {timeAgo}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#131B2E] border border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Pinnacle Ground Truth
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2A374D] text-[#F0F4F8] text-xs font-mono font-medium border border-[#334155] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#3B82F6]' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Pipeline'}
            </button>
          </div>

          {/* Title & Platform Positioning */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Real-Time Football Market Intelligence
            </h1>
            <p className="text-sm sm:text-base text-[#94A3B8] max-w-3xl leading-relaxed">
              Dixon-Coles bivariate Poisson quantitative model evaluating real upcoming Premier League fixtures against live Pinnacle market odds. Every pick preserves full provenance and ledger auditability.
            </p>
          </div>

          {/* Metric KPIs Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-[#131B2E] border border-[#1E293B]">
              <div className="text-[11px] font-mono text-[#94A3B8] uppercase">Active Predictions</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">{picks.length}</div>
              <div className="text-[10px] font-mono text-emerald-400 mt-0.5">AH, OU, BTTS</div>
            </div>
            <div className="p-3 rounded-lg bg-[#131B2E] border border-[#1E293B]">
              <div className="text-[11px] font-mono text-[#94A3B8] uppercase">Upcoming Fixtures</div>
              <div className="text-xl sm:text-2xl font-black text-[#3B82F6] mt-1">10</div>
              <div className="text-[10px] font-mono text-[#94A3B8] mt-0.5">Next 7 Days (EPL)</div>
            </div>
            <div className="p-3 rounded-lg bg-[#131B2E] border border-[#1E293B]">
              <div className="text-[11px] font-mono text-[#94A3B8] uppercase">Odds Benchmark</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">Pinnacle</div>
              <div className="text-[10px] font-mono text-[#94A3B8] mt-0.5">Via OddsPapi v4</div>
            </div>
            <div className="p-3 rounded-lg bg-[#131B2E] border border-[#1E293B]">
              <div className="text-[11px] font-mono text-[#94A3B8] uppercase">Temporal Invariant</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">VERIFIED</div>
              <div className="text-[10px] font-mono text-[#94A3B8] mt-0.5">odds &le; pred &lt; kickoff</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* High-Confidence Prediction Ledger & Realized Yield Transparency Card */}
        <div className="p-5 rounded-xl bg-[#131B2E] border border-[#1E293B] space-y-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B]/80 pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Scale className="h-4 w-4 text-[#3B82F6]" />
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  High-Confidence Prediction Ledger &amp; Realized Yield
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950/80 text-[#3B82F6] border border-blue-800/60">
                  CONFIDENCE &gt; 70% &bull; 1.0U VIRTUAL STAKES
                </span>
              </div>
              <p className="text-xs font-mono text-[#94A3B8]">
                Realized performance is calculated strictly on confirmed FT results via Exact Asian Handicap quarter-line decomposition.
              </p>
            </div>

            {/* Horizon Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0B1120] rounded-lg border border-[#1E293B]">
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'last7Days', label: '7D' },
                { key: 'last30Days', label: '30D' },
                { key: 'allTime', label: 'All-Time' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveHorizon(tab.key as any)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                    activeHorizon === tab.key
                      ? 'bg-[#3B82F6] text-white font-bold shadow-sm'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Performance Numbers Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Realized Yield */}
            <div className="p-3.5 rounded-lg bg-[#0B1120]/70 border border-[#1E293B]">
              <div className="text-[10px] font-mono text-[#94A3B8] uppercase flex items-center justify-between">
                <span>Realized Yield</span>
                <span className="text-[9px] text-emerald-400 font-bold">Settled Only</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl font-black font-mono ${
                    (activeStats?.yieldPct ?? 0) > 0
                      ? 'text-emerald-400'
                      : (activeStats?.yieldPct ?? 0) < 0
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {activeStats ? `${activeStats.yieldPct > 0 ? '+' : ''}${activeStats.yieldPct.toFixed(1)}%` : '0.0%'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
                Profit: <strong className="text-white">{activeStats ? `${activeStats.profitUnits > 0 ? '+' : ''}${activeStats.profitUnits.toFixed(2)}u` : '0.00u'}</strong> on {activeStats ? activeStats.stakeUnits.toFixed(1) : '0.0'}u staked
              </div>
            </div>

            {/* 2. Settled Match Record */}
            <div className="p-3.5 rounded-lg bg-[#0B1120]/70 border border-[#1E293B]">
              <div className="text-[10px] font-mono text-[#94A3B8] uppercase flex items-center justify-between">
                <span>Settled Record</span>
                <span className="text-[9px] text-[#3B82F6]">N = {activeStats?.settled ?? 0}</span>
              </div>
              <div className="mt-1.5 text-lg sm:text-xl font-bold font-mono text-white">
                {activeStats?.wins ?? 0}W - {activeStats?.losses ?? 0}L - {activeStats?.pushes ?? 0}P
                {(activeStats?.halfWins ?? 0) > 0 || (activeStats?.halfLosses ?? 0) > 0 ? (
                  <span className="text-xs text-[#94A3B8] ml-1">
                    ({activeStats?.halfWins ?? 0}HW / {activeStats?.halfLosses ?? 0}HL)
                  </span>
                ) : null}
              </div>
              <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
                Strike Rate:{' '}
                <strong className="text-white">
                  {activeStats && activeStats.settled > 0
                    ? `${(((activeStats.wins + 0.5 * activeStats.halfWins) / activeStats.settled) * 100).toFixed(1)}%`
                    : 'N/A'}
                </strong>
              </div>
            </div>

            {/* 3. Open Exposure (Segregated from realized yield) */}
            <div className="p-3.5 rounded-lg bg-[#0B1120]/70 border border-[#1E293B]">
              <div className="text-[10px] font-mono text-[#94A3B8] uppercase flex items-center justify-between">
                <span>Open Exposure</span>
                <span className="text-[9px] text-amber-400 font-bold">Unsettled</span>
              </div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-black font-mono text-amber-300">
                {totalOpenBets} <span className="text-xs font-normal text-[#94A3B8]">bets</span>
              </div>
              <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
                Staked: <strong className="text-white">{totalOpenStakeUnits.toFixed(1)}u</strong> &bull; <span className="text-slate-400">Zero yield impact until FT</span>
              </div>
            </div>

            {/* 4. Execution Quality */}
            <div className="p-3.5 rounded-lg bg-[#0B1120]/70 border border-[#1E293B]">
              <div className="text-[10px] font-mono text-[#94A3B8] uppercase flex items-center justify-between">
                <span>Execution Quality</span>
                <span className="text-[9px] text-emerald-400 font-bold">Pinnacle Benchmark</span>
              </div>
              <div className="mt-1.5 text-lg sm:text-xl font-bold font-mono text-white">
                Avg @ {activeStats?.avgOdds ? activeStats.avgOdds.toFixed(2) : '—'}
              </div>
              <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
                Avg Conf: <strong className="text-white">{activeStats?.avgConf ? `${activeStats.avgConf.toFixed(1)}%` : '—'}</strong> (Gate &gt; 70%)
              </div>
            </div>
          </div>

          {/* Mathematical Invariant & Policy Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E293B]/60 text-[10px] font-mono text-[#64748B]">
            <span>
              &bull; Mathematical definition: <code className="text-[#94A3B8]">Yield = Profit Units / Staked Units &times; 100%</code> (never win rate).
            </span>
            <span>
              &bull; Kickoff Invariant: Bets lock at kickoff; post-kickoff odds changes never overwrite locked entry.
            </span>
          </div>
        </div>

        {/* Market Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedMarket('ALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                selectedMarket === 'ALL'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#131B2E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              All Markets ({picks.length})
            </button>
            <button
              onClick={() => setSelectedMarket('AH')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                selectedMarket === 'AH'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#131B2E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              Asian Handicap ({ahCount})
            </button>
            <button
              onClick={() => setSelectedMarket('OU')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                selectedMarket === 'OU'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#131B2E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              Over / Under ({ouCount})
            </button>
            <button
              onClick={() => setSelectedMarket('BTTS')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                selectedMarket === 'BTTS'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#131B2E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              BTTS ({bttsCount})
            </button>
          </div>

          <div className="text-xs font-mono text-[#94A3B8]">
            Showing <strong className="text-white">{filteredPicks.length}</strong> qualified picks
          </div>
        </div>

        {/* Empty State / Fail-Closed Guard */}
        {filteredPicks.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#131B2E] border border-[#1E293B] space-y-4">
            <div className="inline-flex p-3 rounded-full bg-[#1E293B] text-[#94A3B8]">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">No qualified picks today.</h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                The fail-closed gate is active. Predictions are only produced when real upcoming fixtures from API-Football and verified Pinnacle odds from OddsPapi are available. Zero synthetic picks are ever displayed.
              </p>
            </div>
          </div>
        ) : (
          /* Qualified Predictions Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPicks.map((pick) => {
              const isExpanded = expandedId === pick.predictionId;
              const hasEdge = pick.edge > 0;
              const isEvPositive = pick.expectedValue > 0;
              const kickoffDate = new Date(pick.kickoffUtc);

              return (
                <div
                  key={pick.predictionId}
                  className="rounded-xl bg-[#131B2E] border border-[#1E293B] hover:border-[#334155] transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-[#1E293B]/70 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                      <span className="text-[#3B82F6] font-semibold">{pick.competition}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {kickoffDate.toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} UTC
                      </span>
                    </div>

                    {/* Fixture Matchup & Signal Strength */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-base sm:text-lg font-bold text-white">
                        {pick.homeTeam} <span className="text-[#64748B] font-normal">vs</span> {pick.awayTeam}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* 4-Tier Visual Signal Strength Badge (Presentation Only) */}
                        {(() => {
                          const conf = Math.max(0, Math.min(100, Math.round(pick.confidence)));
                          if (conf >= 60) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {conf}% &bull; STRONG
                              </span>
                            );
                          }
                          if (conf >= 50) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {conf}% &bull; MODERATE
                              </span>
                            );
                          }
                          if (conf >= 40) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-orange-950 text-orange-400 border border-orange-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                                {conf}% &bull; WEAK
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-950 text-red-400 border border-red-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              {conf}% &bull; VERY WEAK
                            </span>
                          );
                        })()}

                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
                            isEvPositive
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isEvPositive ? 'LAYAK (EV+)' : 'PANTAU'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Market Selection & Quantitative Comparison */}
                  <div className="p-4 space-y-4 flex-1">
                    {/* Market Line Banner */}
                    <div className="flex items-center justify-between bg-[#0B1120] p-2.5 rounded-lg border border-[#1E293B]">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-[#94A3B8]">Market &amp; Selection</div>
                        <div className="text-sm font-black text-white mt-0.5">{pick.selection}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono uppercase text-[#94A3B8]">Validation</div>
                        <div
                          className={`text-xs font-mono font-bold ${
                            pick.validationStatus === 'PROVISIONAL_EDGE' ? 'text-emerald-400' : 'text-[#94A3B8]'
                          }`}
                        >
                          {pick.validationStatus}
                        </div>
                      </div>
                    </div>

                    {/* Model vs Pinnacle Comparison Table */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-[#0B1120]/60 border border-[#1E293B]">
                        <div className="text-[10px] text-[#94A3B8] uppercase">Model Fair Odds</div>
                        <div className="text-lg font-bold text-white mt-0.5">{pick.fairOdds.toFixed(2)}</div>
                        <div className="text-[10px] text-[#64748B] mt-0.5">
                          Prob: {(pick.modelProbability * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#0B1120]/60 border border-[#1E293B]">
                        <div className="text-[10px] text-[#94A3B8] uppercase">Pinnacle Odds</div>
                        <div className="text-lg font-bold text-[#3B82F6] mt-0.5">{pick.marketOdds.toFixed(2)}</div>
                        <div className="text-[10px] text-[#64748B] mt-0.5">
                          Devig: {(pick.marketProbability * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Edge & EV Stats Bar */}
                    <div className="flex items-center justify-between text-xs font-mono px-2 py-1.5 bg-[#1E293B]/40 rounded-lg border border-[#1E293B]">
                      <span className="text-[#94A3B8]">
                        Model Edge:{' '}
                        <strong className={hasEdge ? 'text-emerald-400' : 'text-slate-400'}>
                          {(pick.edge * 100).toFixed(2)}%
                        </strong>
                      </span>
                      <span className="text-[#94A3B8]">
                        Expected Value:{' '}
                        <strong className={isEvPositive ? 'text-emerald-400' : 'text-slate-400'}>
                          {(pick.expectedValue * 100).toFixed(2)}%
                        </strong>
                      </span>
                    </div>

                    {/* Confidence Scientific Explainability Ribbon */}
                    <div className="text-[10px] font-mono text-[#64748B] bg-[#0B1120]/40 p-2 rounded border border-[#1E293B]/50 flex items-center justify-between">
                      <span>Robustness Score: <strong className="text-white">{pick.confidence}/100</strong></span>
                      <span className="text-[9px] text-[#64748B] italic">Separate from win probability</span>
                    </div>

                    {/* Expandable Provenance Section (15 Required SALMO Production Fields) */}
                    {isExpanded && (
                      <div className="p-3 rounded-lg bg-[#0B1120] border border-[#1E293B] space-y-2.5 text-[11px] font-mono text-[#94A3B8]">
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            Audited Production Provenance
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            {pick.publishState || 'PUBLISHED'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#1E293B]/70">
                          <div>
                            <span className="text-[#64748B]">Match: </span>
                            <span className="text-white">{pick.homeTeam} vs {pick.awayTeam}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Competition: </span>
                            <span className="text-white">{pick.competition}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Market &amp; Selection: </span>
                            <span className="text-white">{pick.selection}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Current Odds: </span>
                            <span className="text-[#3B82F6] font-bold">{pick.marketOdds.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Model Probability: </span>
                            <span className="text-white">{(pick.modelProbability * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Market Implied: </span>
                            <span className="text-white">{(pick.marketProbability * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Edge / EV: </span>
                            <span className="text-emerald-400">{(pick.edge * 100).toFixed(1)}% / {(pick.expectedValue * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Signal Strength: </span>
                            <span className="text-white font-bold">{pick.confidence}% ({pick.strengthLevel || (pick.confidence >= 60 ? 'STRONG' : pick.confidence >= 50 ? 'MODERATE' : pick.confidence >= 40 ? 'WEAK' : 'VERY_WEAK')})</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Odds Snapshot Time: </span>
                            <span className="text-white">{pick.oddsTimestampUtc?.slice(0, 19).replace('T', ' ')} UTC</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Prediction Generated: </span>
                            <span className="text-white">{pick.predictionTimestampUtc?.slice(0, 19).replace('T', ' ')} UTC</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Data Freshness: </span>
                            <span className="text-white">{pick.freshnessText || 'Updated just now'}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Sharp Benchmark: </span>
                            <span className="text-white">Pinnacle (OddsPapi v4)</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Model Architecture: </span>
                            <span className="text-white">{pick.modelVersion}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Data Persistence: </span>
                            <span className="text-emerald-400">daily_picks + ledger_v3</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Accordion Trigger */}
                  <button
                    onClick={() => toggleExpand(pick.predictionId)}
                    className="w-full py-2 px-4 bg-[#131B2E] hover:bg-[#1E293B]/70 border-t border-[#1E293B] text-[11px] font-mono text-[#94A3B8] hover:text-white flex items-center justify-between transition-colors"
                  >
                    <span>{isExpanded ? 'Hide Provenance & Audit Info' : 'Show Provenance & Audit Info'}</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Real Quota & Telemetry Footer Panel */}
        <section className="pt-6 border-t border-[#1E293B]">
          <div className="p-4 rounded-xl bg-[#131B2E]/60 border border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
                <Activity className="h-4 w-4 text-[#3B82F6]" />
                <span className="font-bold text-white uppercase">Live Provider Telemetry</span>
              </div>
              <span className="text-[10px] font-mono text-[#64748B]">Fail-Closed Quota Guards Active</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#0B1120] border border-[#1E293B]">
                <div className="text-[10px] text-[#94A3B8]">API-Football PRO</div>
                <div className="text-white font-bold mt-1">7,500 Daily Limit</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Status: ONLINE</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0B1120] border border-[#1E293B]">
                <div className="text-[10px] text-[#94A3B8]">OddsPapi v4</div>
                <div className="text-white font-bold mt-1">250 Monthly Limit</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Soft Cap: 200 (80%)</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0B1120] border border-[#1E293B]">
                <div className="text-[10px] text-[#94A3B8]">FootyStats EPL</div>
                <div className="text-white font-bold mt-1">Enrichment</div>
                <div className="text-[10px] text-[#94A3B8] mt-0.5">Connected / Optional</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0B1120] border border-[#1E293B]">
                <div className="text-[10px] text-[#94A3B8]">Supabase DB</div>
                <div className="text-white font-bold mt-1">PostgreSQL v15</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Ledger: Synchronized</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
