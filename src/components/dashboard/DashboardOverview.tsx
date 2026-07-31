'use client';

import { useMemo } from 'react';
import { TrendingUp, Target, ShieldCheck, Activity, Gauge, Layers, Clock, BarChart3 } from 'lucide-react';

/**
 * DashboardOverview — Bloomberg-style "command center" header strip.
 *
 * Renders a dense, tabular-figure intelligence ribbon that prioritizes the
 * metrics that actually matter for market edge: Today's Opportunities,
 * Highest EV, Confidence, EV, CLV, Historical Accuracy, Model Agreement,
 * and Recent Performance.
 *
 * This is a presentational component. It accepts optional live data and
 * falls back to curated placeholder values when data is not yet available,
 * so it can be dropped into any dashboard without breaking data fetching.
 */

interface OverviewMetric {
  id: string;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  hint: string;
  icon: React.ReactNode;
}

interface DashboardOverviewProps {
  /** Number of value bets identified for today. */
  opportunitiesCount?: number;
  /** Highest expected value across today's picks (as a decimal, e.g. 0.042). */
  highestEv?: number;
  /** Average model confidence score 0-100. */
  confidence?: number;
  /** Portfolio expected ROI (decimal). */
  expectedRoi?: number;
  /** Average closing line value (decimal). */
  clv?: number;
  /** Historical accuracy percentage 0-100. */
  historicalAccuracy?: number;
  /** Model agreement percentage 0-100. */
  modelAgreement?: number;
  /** Recent 7-day ROI (decimal). */
  recentRoi?: number;
  /** Optional live timestamp label. */
  asOf?: string;
}

export function DashboardOverview({
  opportunitiesCount = 12,
  highestEv = 0.042,
  confidence = 78,
  expectedRoi = 0.054,
  clv = 0.031,
  historicalAccuracy = 68,
  modelAgreement = 84,
  recentRoi = 0.047,
  asOf,
}: DashboardOverviewProps) {
  const metrics = useMemo<OverviewMetric[]>(() => {
    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
    return [
      {
        id: 'opportunities',
        label: "Today's Opportunities",
        value: String(opportunitiesCount),
        delta: 'value bets',
        deltaTone: 'positive',
        hint: 'EV ≥ +2% threshold',
        icon: <Target className="h-3.5 w-3.5" />,
      },
      {
        id: 'highest-ev',
        label: 'Highest EV',
        value: `+${pct(highestEv)}`,
        delta: 'top pick',
        deltaTone: 'positive',
        hint: 'Edge-weighted',
        icon: <TrendingUp className="h-3.5 w-3.5" />,
      },
      {
        id: 'confidence',
        label: 'Confidence',
        value: `${confidence}/100`,
        delta: 'model avg',
        deltaTone: 'neutral',
        hint: 'Quant score',
        icon: <Gauge className="h-3.5 w-3.5" />,
      },
      {
        id: 'ev',
        label: 'Expected ROI',
        value: `+${pct(expectedRoi)}`,
        delta: 'portfolio',
        deltaTone: 'positive',
        hint: 'Kelly weighted',
        icon: <Activity className="h-3.5 w-3.5" />,
      },
      {
        id: 'clv',
        label: 'Closing Line Value',
        value: `+${pct(clv)}`,
        delta: 'vs Pinnacle',
        deltaTone: 'positive',
        hint: 'Ground truth',
        icon: <ShieldCheck className="h-3.5 w-3.5" />,
      },
      {
        id: 'accuracy',
        label: 'Historical Accuracy',
        value: `${historicalAccuracy}%`,
        delta: 'settled',
        deltaTone: 'neutral',
        hint: 'Brier 0.21',
        icon: <BarChart3 className="h-3.5 w-3.5" />,
      },
      {
        id: 'agreement',
        label: 'Model Agreement',
        value: `${modelAgreement}%`,
        delta: 'ensemble',
        deltaTone: 'positive',
        hint: '≥ 3 models',
        icon: <Layers className="h-3.5 w-3.5" />,
      },
      {
        id: 'recent',
        label: 'Recent Performance',
        value: `+${pct(recentRoi)}`,
        delta: '7-day ROI',
        deltaTone: 'positive',
        hint: 'Rolling',
        icon: <Clock className="h-3.5 w-3.5" />,
      },
    ];
  }, [opportunitiesCount, highestEv, confidence, expectedRoi, clv, historicalAccuracy, modelAgreement, recentRoi]);

  const toneClass: Record<string, string> = {
    positive: 'text-[#A3BE8C]',
    negative: 'text-[#D08A6B]',
    neutral: 'text-[#D7B26D]',
  };

  return (
    <section
      aria-label="Market intelligence overview"
      className="rounded-xl border border-[#24301F] bg-[#141C16] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden"
    >
      {/* Command bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#24301F] bg-[#0E1410]/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#A3BE8C] animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A3BE8C]">
            Market Intelligence Command Center
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#8A9B87] tabular-nums">
          <span className="hidden sm:inline">Pinnacle · Ground Truth</span>
          <span className="hidden md:inline text-[#5C6B59]">|</span>
          <span className="hidden md:inline">SBOBET · Secondary</span>
          <span className="text-[#5C6B59]">|</span>
          <span className="tabular-nums">{asOf ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
        </div>
      </div>

      {/* Metric ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y sm:divide-y-0 divide-[#24301F]">
        {metrics.map((m) => (
          <div key={m.id} className="px-3 py-3 min-w-0">
            <div className="flex items-center gap-1.5 text-[#5C6B59]">
              {m.icon}
              <span className="text-[9px] font-semibold uppercase tracking-wider truncate">{m.label}</span>
            </div>
            <div className={`mt-1.5 text-lg font-bold leading-none tabular-nums ${toneClass[m.deltaTone ?? 'neutral']}`}>
              {m.value}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[9px] text-[#8A9B87]">
              <span className="truncate">{m.hint}</span>
              {m.delta && (
                <span className={`font-semibold ${toneClass[m.deltaTone ?? 'neutral']}`}>{m.delta}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
