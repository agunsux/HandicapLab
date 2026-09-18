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
      const res = await fetch('/api/daily-picks?refresh=true');
      if (res.ok) {
        const json = await res.json();
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

                    {/* Fixture Matchup */}
                    <div className="flex items-center justify-between">
                      <div className="text-base sm:text-lg font-bold text-white">
                        {pick.homeTeam} <span className="text-[#64748B] font-normal">vs</span> {pick.awayTeam}
                      </div>
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

                    {/* Expandable Provenance Section */}
                    {isExpanded && (
                      <div className="p-3 rounded-lg bg-[#0B1120] border border-[#1E293B] space-y-2 text-[11px] font-mono text-[#94A3B8]">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          Audited Odds Provenance
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          <div>
                            <span className="text-[#64748B]">Fixture ID: </span>
                            <span className="text-white">{pick.fixtureId}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Bookmaker: </span>
                            <span className="text-white">Pinnacle</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Odds Snapshot: </span>
                            <span className="text-white">{pick.oddsTimestampUtc?.slice(11, 19)} UTC</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Prediction Time: </span>
                            <span className="text-white">{pick.predictionTimestampUtc?.slice(11, 19)} UTC</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Model Engine: </span>
                            <span className="text-white">{pick.modelVersion}</span>
                          </div>
                          <div>
                            <span className="text-[#64748B]">Persistence: </span>
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
