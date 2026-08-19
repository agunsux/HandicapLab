'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  ShieldCheck,
  Calendar,
  Layers,
  Database,
  CheckCircle2,
} from 'lucide-react';
import type { HomepageData, Opportunity, UpcomingFixtureItem } from './types';

// HOMEPAGE INTELLIGENCE DASHBOARD — consumes /api/v1/homepage (real DB values).

type LoadState = 'LOADING' | 'READY' | 'ERROR';

function fmtPct(v: number | null, d = 2): string {
  if (v === null || Number.isNaN(v)) return '—';
  return v > 0 ? `+${v.toFixed(d)}%` : `${v.toFixed(d)}%`;
}

function fmtNum(v: number | null, d = 4): string {
  if (v === null || Number.isNaN(v)) return '—';
  return v.toFixed(d);
}

function fmtEv(v: number, d = 2): string {
  const p = v * 100;
  return p > 0 ? `+${p.toFixed(d)}%` : `${p.toFixed(d)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function gradeCls(g: string | null): string {
  if (g === 'A') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (g === 'B') return 'bg-lime-500/15 text-lime-400 border-lime-500/30';
  if (g === 'C') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-zinc-800 text-zinc-400 border-zinc-700';
}

function statusBadgeCls(status: string): string {
  switch (status) {
    case 'VALUE_FOUND':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'MODELABLE_NO_VALUE':
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    case 'MODEL_PENDING':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'STALE':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'NO_ODDS':
    default:
      return 'bg-zinc-800 text-zinc-500 border-zinc-700/50';
  }
}

const REFRESH_MS = 60_000;

export function HomepageDashboard() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [state, setState] = useState<LoadState>('LOADING');
  const [activeTab, setActiveTab] = useState<'all' | 'value'>('value');

  async function load() {
    try {
      const res = await fetch('/api/v1/homepage', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setState('READY');
      } else {
        setState('ERROR');
      }
    } catch (err) {
      console.error('[HomepageDashboard] Failed:', err);
      setState('ERROR');
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (state === 'LOADING' && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center bg-[#0B0F0E] min-h-[400px]">
        <Loader2 className="h-9 w-9 animate-spin text-[#10B981] mb-4" />
        <div className="text-xs text-[#9CA3AF] font-mono uppercase tracking-widest">
          Loading market intelligence…
        </div>
      </div>
    );
  }

  if (state === 'ERROR' && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center bg-[#0B0F0E] rounded-xl border border-red-900/40 p-8 my-8">
        <AlertTriangle className="h-9 w-9 text-red-400 mb-4" />
        <div className="text-base text-zinc-200 font-semibold mb-1">
          Market data unavailable
        </div>
        <div className="text-xs text-zinc-500 font-mono mb-6 max-w-md">
          Unable to retrieve real-time intelligence from the database. No synthetic data will be shown.
        </div>
        <button
          onClick={() => {
            setState('LOADING');
            load();
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black text-xs font-bold transition-colors shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { historical, live } = data;
  const s = historical.summary;
  const upcomingList = live.upcomingFixtures ?? [];

  const liveStateBadge =
    live.state === 'READY'
      ? { text: 'Market Active', cls: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30' }
      : live.state === 'NO_FIXTURES'
      ? { text: 'No Upcoming Fixtures', cls: 'text-zinc-400 bg-zinc-800 border-zinc-700' }
      : live.state === 'NO_ODDS'
      ? { text: 'Awaiting Sharp Odds', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
      : live.state === 'NOT_MODELABLE'
      ? { text: 'Features Pending', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
      : live.state === 'NO_VALUE'
      ? { text: 'Zero Positive EV', cls: 'text-zinc-400 bg-zinc-800 border-zinc-700' }
      : { text: 'Market Blocked', cls: 'text-red-400 bg-red-500/10 border-red-500/30' };

  return (
    <div className="space-y-12 pb-16 font-sans text-zinc-100">
      {/* ── SECTION 1: HERO / CURRENT MARKET OVERVIEW ─────────────────────── */}
      <section className="rounded-2xl border border-[#1F2937] bg-gradient-to-b from-[#111827]/80 to-[#0B0F0E] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937] pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF]">
                Quantitative Football Market Terminal
              </span>
              <span className={cn('text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full border', liveStateBadge.cls)}>
                {liveStateBadge.text}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Live Market Intelligence
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#9CA3AF] font-mono">
            {live.lastOddsUpdate && (
              <div className="flex items-center gap-1.5 bg-[#0B0F0E] px-3 py-1.5 rounded-lg border border-[#1F2937]">
                <Clock className="h-3.5 w-3.5 text-[#10B981]" />
                <span>Pinnacle Odds: {fmtDate(live.lastOddsUpdate)}</span>
              </div>
            )}
            <button
              onClick={load}
              className="p-2 rounded-lg bg-[#0B0F0E] border border-[#1F2937] hover:border-[#10B981]/40 text-[#9CA3AF] hover:text-[#10B981] transition-colors"
              title="Refresh live data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* HERO STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HeroStatCard
            label="Upcoming Fixtures"
            value={live.fixtures.total}
            sub="Pre-match scheduled"
            icon={Calendar}
          />
          <HeroStatCard
            label="Modelable Coverage"
            value={live.fixtures.modelable}
            sub="Features & model active"
            icon={Activity}
          />
          <HeroStatCard
            label="Value Opportunities"
            value={live.fixtures.withValue}
            sub="EV ≥ +2.0% valid edge"
            accent="text-[#10B981]"
            borderAccent="border-[#10B981]/30 bg-[#10B981]/5"
            icon={TrendingUp}
          />
          <HeroStatCard
            label="Strong Value Bets"
            value={live.fixtures.strongValue}
            sub="EV ≥ +5.0% prime signals"
            accent="text-emerald-400"
            borderAccent="border-emerald-500/30 bg-emerald-500/5"
            icon={ShieldCheck}
          />
        </div>
      </section>

      {/* ── SECTION 2: BEST VALUE OPPORTUNITIES ─────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#1F2937] pb-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#10B981] font-semibold">
              Actionable Edge Stream
            </div>
            <h2 className="text-xl font-display font-bold text-white">
              Best Value Opportunities
            </h2>
          </div>
          <div className="text-xs text-[#9CA3AF] font-mono">
            Sorted by Expected Value (EV) · Pinnacle Closing Line Benchmark
          </div>
        </div>

        {live.opportunities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1F2937] bg-[#111827]/30 py-14 px-6 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 mb-3">
              <Minus className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold text-zinc-200 mb-1">
              {live.state === 'NO_VALUE'
                ? 'No positive EV opportunities at current market lines'
                : 'No opportunities currently meet edge and confidence criteria'}
            </div>
            <div className="text-xs text-[#9CA3AF] font-mono max-w-md mx-auto">
              Signals appear only when fixture features, sharp odds, and mathematical edge pass our strict calibration filter.
            </div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-[#1F2937] bg-[#0B0F0E] shadow-xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="text-[10px] text-[#9CA3AF] uppercase bg-[#111827]/80 border-b border-[#1F2937] font-mono tracking-widest">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Match</th>
                  <th className="px-4 py-3.5 font-semibold">Competition</th>
                  <th className="px-4 py-3.5 font-semibold">Kickoff</th>
                  <th className="px-4 py-3.5 font-semibold">Market</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Line</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Odds</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Model %</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Fair Odds</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Edge</th>
                  <th className="px-4 py-3.5 font-semibold text-right">EV</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]/70 font-mono text-[11px]">
                {live.opportunities.map((o) => (
                  <tr key={`${o.fixtureId}-${o.market}-${o.line}`} className="hover:bg-[#111827]/50 transition-colors">
                    <td className="px-4 py-3.5 font-sans">
                      <div className="font-semibold text-zinc-100">{o.homeTeam} vs {o.awayTeam}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-mono mt-0.5">{o.bookmaker}</div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 font-sans">{o.competition}</td>
                    <td className="px-4 py-3.5 text-zinc-400">{fmtDate(o.kickoff)}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-zinc-200 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50">
                        {o.market}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">
                      {o.line !== null ? o.line : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-white">
                      {o.odds.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-300">
                      {(o.modelProbability * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-400">
                      {o.fairOdds.toFixed(2)}
                    </td>
                    <td className={cn('px-4 py-3.5 text-right font-semibold', o.edge > 0 ? 'text-zinc-200' : 'text-zinc-500')}>
                      {fmtEv(o.edge)}
                    </td>
                    <td className={cn('px-4 py-3.5 text-right font-extrabold text-xs', o.ev >= 0.05 ? 'text-[#10B981]' : 'text-lime-400')}>
                      {fmtEv(o.ev)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-bold border', gradeCls(o.grade))}>
                        {o.grade ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── SECTION 3: UPCOMING FIXTURES PIPELINE ───────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#1F2937] pb-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-semibold">
              Live Fixture Registry
            </div>
            <h2 className="text-xl font-display font-bold text-white">
              Upcoming Match Coverage
            </h2>
          </div>
          <div className="text-xs text-[#9CA3AF] font-mono">
            All tracked pre-match fixtures and model eligibility states
          </div>
        </div>

        {upcomingList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1F2937] bg-[#111827]/30 py-10 px-6 text-center">
            <div className="text-sm text-zinc-400 font-medium mb-1">
              No upcoming matches in queue
            </div>
            <div className="text-xs text-zinc-600 font-mono">
              The ingestion pipeline automatically pulls scheduled fixtures before each kickoff window.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingList.map((f) => (
              <div
                key={f.fixtureId}
                className="rounded-xl border border-[#1F2937] bg-[#111827]/60 p-4 hover:border-zinc-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#9CA3AF] mb-2">
                    <span className="truncate uppercase font-semibold text-zinc-300">
                      {f.competition}
                    </span>
                    <span>{fmtDate(f.kickoff)}</span>
                  </div>

                  <div className="font-semibold text-sm text-zinc-100 mb-3">
                    {f.homeTeam} <span className="text-zinc-500 font-normal">vs</span> {f.awayTeam}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1F2937]/80 flex items-center justify-between gap-2 text-xs">
                  <span
                    className={cn(
                      'text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border',
                      statusBadgeCls(f.status)
                    )}
                  >
                    {f.statusLabel}
                  </span>

                  {f.bestEv !== null && f.bestEv >= 0.02 && (
                    <span className="text-[11px] font-mono font-bold text-[#10B981]">
                      {fmtEv(f.bestEv)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 4: HISTORICAL MODEL PERFORMANCE ─────────────────────── */}
      <section className="border-t border-[#1F2937] pt-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#10B981] font-semibold">
                Verified Gold Layer · Zero Future Leakage
              </span>
              <span className="text-[9px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                {historical.methodology ?? 'Walk-Forward Expanding Window'}
              </span>
            </div>
            <h2 className="text-xl font-display font-bold text-white">
              Historical Model Performance
            </h2>
          </div>
          <div className="text-xs text-[#9CA3AF] font-mono">
            Dataset: <span className="text-zinc-200 font-bold">{historical.datasetVersion ?? 'europe-dataset-v1'}</span> · Model: <span className="text-zinc-200 font-bold">{historical.modelVersion ?? 'prematch-v1'}</span>
          </div>
        </div>

        {!s ? (
          <div className="rounded-2xl border border-dashed border-[#1F2937] bg-[#111827]/30 py-12 text-center">
            <div className="text-sm text-zinc-400 font-medium mb-1">
              Backtest calculation pending
            </div>
            <div className="text-xs text-zinc-600 font-mono">
              Historical performance statistics will appear once the walk-forward engine completes persistence.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* HERO PERFORMANCE METRICS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <MetricBox
                label="Historical ROI"
                value={fmtPct(s.roi)}
                positive={(s.roi ?? 0) > 0}
                negative={(s.roi ?? 0) < 0}
              />
              <MetricBox
                label="Win Rate"
                value={s.winRate !== null ? `${s.winRate.toFixed(1)}%` : '—'}
              />
              <MetricBox
                label="Average CLV"
                value={fmtPct(s.clv)}
                positive={(s.clv ?? 0) > 0}
              />
              <MetricBox
                label="Brier Score"
                value={fmtNum(s.brierScore, 4)}
              />
              <MetricBox
                label="Log Loss"
                value={fmtNum(s.logLoss, 4)}
              />
              <MetricBox
                label="Max Drawdown"
                value={s.maxDrawdown !== null ? `${s.maxDrawdown.toFixed(1)}u` : '—'}
                negative={(s.maxDrawdown ?? 0) > 0}
              />
              <MetricBox
                label="Matches Tested"
                value={s.matches !== null ? s.matches.toLocaleString() : '—'}
              />
              <MetricBox
                label="Signals Evaluated"
                value={s.bets !== null ? s.bets.toLocaleString() : '—'}
              />
            </div>

            {/* MARKET-LEVEL BREAKDOWN CARDS */}
            {historical.markets.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-[#9CA3AF] font-semibold">
                  Market Performance Breakdown
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {historical.markets.map((m) => (
                    <div
                      key={m.market}
                      className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-4 relative overflow-hidden"
                    >
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF] mb-1">
                        {m.market === 'ML'
                          ? 'Moneyline (1X2)'
                          : m.market === 'AH'
                          ? 'Asian Handicap'
                          : m.market === 'OU'
                          ? 'Over / Under (2.5)'
                          : 'Both Teams to Score'}
                      </div>
                      <div
                        className={cn(
                          'text-2xl font-bold tabular-nums mb-2',
                          (m.roiPct ?? 0) > 0
                            ? 'text-[#10B981]'
                            : (m.roiPct ?? 0) < 0
                            ? 'text-red-400'
                            : 'text-zinc-200'
                        )}
                      >
                        {fmtPct(m.roiPct)}
                      </div>
                      <div className="space-y-1 text-[11px] text-[#9CA3AF] font-mono border-t border-[#1F2937] pt-2">
                        <div className="flex justify-between">
                          <span>Total Bets:</span>
                          <span className="text-zinc-200 font-semibold">{m.totalBets.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Win Rate:</span>
                          <span className="text-zinc-200 font-semibold">{m.winRate !== null ? `${m.winRate.toFixed(1)}%` : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Closing Edge (CLV):</span>
                          <span className={cn('font-semibold', (m.avgClvPct ?? 0) > 0 ? 'text-[#10B981]' : 'text-zinc-400')}>
                            {fmtPct(m.avgClvPct)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Brier Score:</span>
                          <span className="text-zinc-200 font-semibold">{fmtNum(m.brierScore, 4)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── FOOTER: GOVERNANCE & PROVENANCE ──────────────────────────────── */}
      <footer className="border-t border-[#1F2937] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF] font-mono">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#10B981]" />
          <span>Single Source of Truth: API-Football (Fixtures) · OddsPAPI / Pinnacle (Odds)</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Auto-refresh: 60s</span>
          <span>•</span>
          <span>Fail-Closed Governance</span>
        </div>
      </footer>
    </div>
  );
}

function HeroStatCard({
  label,
  value,
  sub,
  accent,
  borderAccent,
  icon: Icon,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: string;
  borderAccent?: string;
  icon: any;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[#1F2937] bg-[#111827]/70 p-4 relative overflow-hidden transition-all',
        borderAccent
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#9CA3AF]">{label}</span>
        <Icon className={cn('h-4 w-4', accent ?? 'text-zinc-500')} />
      </div>
      <div className={cn('text-3xl font-bold tabular-nums tracking-tight', accent ?? 'text-white')}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-zinc-500 font-mono mt-1">{sub}</div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  return (
    <div className="rounded-xl border border-[#1F2937] bg-[#111827]/70 p-3 flex flex-col justify-between">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] mb-1.5">
        <span className="truncate">{label}</span>
        <Icon className={cn('h-3 w-3 shrink-0', positive ? 'text-[#10B981]' : negative ? 'text-red-400' : 'text-zinc-500')} />
      </div>
      <div
        className={cn(
          'text-base sm:text-lg font-bold tabular-nums',
          positive ? 'text-[#10B981]' : negative ? 'text-red-400' : 'text-white'
        )}
      >
        {value}
      </div>
    </div>
  );
}