import React from 'react';
import Link from 'next/link';
import { Target, TrendingUp, CheckCircle2, ArrowRight, ShieldAlert, BarChart3 } from 'lucide-react';
import type { MarketIntelligenceSummary, MarketDiscoveryItem } from '@/lib/services/marketIntelligenceService';
import { DATA_STATE_LABEL, DATA_STATE_TONE, type DataState } from '@/lib/data/dataState';

interface MarketIntelligenceSectionProps {
  summary: MarketIntelligenceSummary;
}

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function roiClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'text-neutral-400';
  return value > 0 ? 'text-[#10B981]' : 'text-red-400';
}

function StateChip({ state }: { state: DataState }) {
  const tone = DATA_STATE_TONE[state];
  const cls =
    tone === 'positive'
      ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
      : tone === 'warning'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : tone === 'negative'
      ? 'bg-red-500/15 text-red-400 border-red-500/30'
      : 'bg-neutral-800 text-neutral-400 border-neutral-700';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${cls}`}>
      {DATA_STATE_LABEL[state]}
    </span>
  );
}

function MarketCard({
  title,
  icon,
  item,
  missingMessage,
}: {
  title: string;
  icon: React.ReactNode;
  item: MarketDiscoveryItem | null;
  missingMessage: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-[#111827]/70 border border-[#1F2937] flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
            {icon}
          </div>
          {item ? (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
              {item.tier}
            </span>
          ) : (
            <StateChip state="INSUFFICIENT_DATA" />
          )}
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>

        {item ? (
          <div className="space-y-2.5 font-mono text-xs mb-4">
            <div className="p-3 rounded-xl bg-[#0B0F0E] border border-[#1F2937]">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 font-bold">Realized ROI (OOS)</span>
                <span className={`font-bold ${roiClass(item.roiPct)}`}>{fmtPct(item.roiPct)}</span>
              </div>
              <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
                <span>Sample: {fmtNum(item.bets)} bets</span>
                <span>Hit Rate: {item.hitRatePct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0F0E] border border-[#1F2937]">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 font-bold">Mean CLV</span>
                <span className={`font-bold ${roiClass(item.clvPct)}`}>{fmtPct(item.clvPct)}</span>
              </div>
              <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
                <span>Brier: {fmtNum(item.brierScore, 4)}</span>
                <span>Max DD: {fmtNum(item.maxDrawdown, 1)}u</span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-neutral-400 bg-neutral-900 border border-[#1F2937] p-2.5 rounded-lg">
              Walk-forward window {item.season} &bull; Top-5 European leagues.
            </div>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg leading-relaxed mb-4">
            {missingMessage}
          </div>
        )}
      </div>

      <div className="mt-2 pt-4 border-t border-[#1F2937] flex items-center justify-between text-xs font-mono">
        <span className="text-[#6B7280]">Source: persisted backtest</span>
        <Link href="/track-record" className="text-[#10B981] hover:underline flex items-center gap-1 font-bold">
          Evidence <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function MarketIntelligenceSection({ summary }: MarketIntelligenceSectionProps) {
  const { asianHandicap, overUnder, btts } = summary;
  const ouItem =
    overUnder.baselineOver25RoiPct == null
      ? null
      : summary.topRankings.find((r) => r.market === 'OU') ?? null;
  const bttsItem = summary.topRankings.find((r) => r.market === 'BTTS') ?? null;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-[#1F2937]/70">
      <div className="text-center mb-12 space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-[#10B981]">
          <BarChart3 className="h-3.5 w-3.5" />
          WALK-FORWARD BACKTEST &bull; OUT-OF-SAMPLE EVIDENCE
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-black text-white tracking-tight">
          Market Evidence
        </h2>
        <p className="text-sm text-[#9CA3AF] max-w-3xl mx-auto leading-relaxed">
          Realized out-of-sample results from the persisted walk-forward backtest. These numbers are
          shown exactly as computed — including negative performance. No profitability claim is made
          until CLV-validated evidence supports it.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <StateChip state={summary.dataState} />
          {summary.sourceFile && (
            <span className="text-[10px] font-mono text-[#6B7280]">{summary.sourceFile}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MarketCard
          title="Asian Handicap"
          icon={<Target className="h-5 w-5" />}
          item={asianHandicap.bestOverall}
          missingMessage="No verified AH backtest rows available."
        />
        <MarketCard
          title="Over / Under"
          icon={<TrendingUp className="h-5 w-5" />}
          item={ouItem}
          missingMessage="No verified OU backtest rows available."
        />
        <MarketCard
          title="Both Teams To Score"
          icon={<CheckCircle2 className="h-5 w-5" />}
          item={bttsItem}
          missingMessage="BTTS historical odds have not been ingested (0 priced rows in the gold dataset). BTTS is calibration-only: no EV, CLV or staking is permitted until real prices exist."
        />
      </div>

      <div className="mt-8 text-[11px] font-mono text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 p-3 rounded-lg flex items-start gap-2">
        <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Integrity notice: EPIC-66 discovery rankings (previously surfaced as +28%/+77% ROI) are
          quarantined pending audit because their own coverage matrix reports zero Pinnacle odds
          rows. Only reproducible walk-forward artifacts are displayed.
        </span>
      </div>
    </section>
  );
}
