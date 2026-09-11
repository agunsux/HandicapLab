'use client';

import React, { useMemo, useState } from 'react';
import type { AhResearchViewModel } from '@/lib/research/ah-yield/ahViewModel';

function pct(x: number | null | undefined, dp = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'N/A';
  return `${x >= 0 ? '+' : ''}${x.toFixed(dp)}%`;
}

function num(x: number | null | undefined, dp = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'N/A';
  return x.toFixed(dp);
}

const SAMPLE_COLORS: Record<string, string> = {
  STRONG_SAMPLE: 'text-[#10B981]',
  MODERATE_SAMPLE: 'text-[#34D399]',
  LOW_SAMPLE: 'text-amber-400',
  INSUFFICIENT_SAMPLE: 'text-red-400',
};

const STATE_COLORS: Record<string, string> = {
  POSITIVE_VALUE: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40',
  NEGATIVE_VALUE: 'bg-red-500/15 text-red-400 border-red-500/40',
  NEUTRAL: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/40',
  INSUFFICIENT_DATA: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
};

export function AhResearchDashboard({ view }: { view: AhResearchViewModel }) {
  const [cohortKey, setCohortKey] = useState(view.headlineCohortKey);
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [sampleFilter, setSampleFilter] = useState<string>('eligible');
  const [sortMode, setSortMode] = useState<'value' | 'roi' | 'ev' | 'probability' | 'sample'>('value');

  const cohort = view.cohorts.find((c) => c.cohortKey === cohortKey) ?? view.cohorts[0];

  const lines = useMemo(
    () => Array.from(new Set(cohort?.valueRows.map((r) => r.line) ?? [])).sort((a, b) => a - b),
    [cohort]
  );

  const rows = useMemo(() => {
    if (!cohort) return [];
    let out = cohort.valueRows.filter((r) => {
      if (lineFilter !== 'all' && String(r.line) !== lineFilter) return false;
      if (sideFilter !== 'all' && r.side !== sideFilter) return false;
      if (stateFilter !== 'all' && r.valueState !== stateFilter) return false;
      if (sampleFilter === 'eligible' && !r.eligibleForBest) return false;
      if (sampleFilter !== 'all' && sampleFilter !== 'eligible' && r.sampleSizeStatus !== sampleFilter) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sortMode) {
        case 'roi': return b.yieldPct - a.yieldPct || b.evaluatedBets - a.evaluatedBets;
        case 'ev': return b.modelEvMean - a.modelEvMean || b.evaluatedBets - a.evaluatedBets;
        case 'probability': return b.modelProbability - a.modelProbability || b.evaluatedBets - a.evaluatedBets;
        case 'sample': return b.evaluatedBets - a.evaluatedBets;
        default: return (b.eligibleForBest ? b.roiCi95[0] : -Infinity) - (a.eligibleForBest ? a.roiCi95[0] : -Infinity) || b.evaluatedBets - a.evaluatedBets;
      }
    });
    return out;
  }, [cohort, lineFilter, sideFilter, stateFilter, sampleFilter, sortMode]);

  if (!cohort) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-300 font-mono text-sm">
        DATA NOT AVAILABLE — the validation report contains no cohorts. Run <code>npm run ah:yield</code>.
      </div>
    );
  }

  const m = cohort.metrics;

  return (
    <div className="space-y-8">
      {/* Cohort selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-[#9CA3AF] uppercase tracking-wider mr-2">Cohort</span>
        {view.cohorts.map((c) => (
          <button
            key={c.cohortKey}
            onClick={() => setCohortKey(c.cohortKey)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
              c.cohortKey === cohort.cohortKey
                ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]'
                : 'bg-[#111827] border-[#1F2937] text-[#9CA3AF] hover:text-white'
            }`}
          >
            {c.provenance} / {c.snapshot} · N={c.metrics.evaluatedBets}
          </button>
        ))}
      </div>

      {/* Best cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {view.bestCards.map((card) => (
          <div key={card.name} className="p-4 rounded-xl bg-[#111827]/70 border border-[#1F2937]">
            <div className="text-[10px] font-mono text-[#9CA3AF] uppercase tracking-wider mb-2">{card.name}</div>
            {card.available && card.pick ? (
              <>
                <div className="text-lg font-bold text-white font-mono">
                  {card.pick.line > 0 ? `+${card.pick.line}` : card.pick.line} {card.pick.side}
                </div>
                <div className={`text-sm font-mono ${card.pick.yieldPct >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                  {pct(card.pick.yieldPct)} yield
                </div>
                <div className="text-[11px] font-mono text-[#9CA3AF] mt-1">
                  N={card.pick.evaluatedBets} · EV {pct(card.pick.modelEvMean * 100)} · {card.pick.sampleSizeStatus.replace('_SAMPLE', '')}
                </div>
              </>
            ) : (
              <div className="text-xs font-mono text-amber-400 leading-relaxed">
                NOT SHOWN — {card.reason ?? 'insufficient sample'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs font-mono">
        {[
          ['Bets', String(m.evaluatedBets)],
          ['Total Stake', num(m.totalStake, 0)],
          ['Total P&L', num(m.totalPnl, 1)],
          ['Yield / ROI', pct(m.yieldPct)],
          ['ROI 95% CI', `${pct(m.roiCi95[0] * 100)} … ${pct(m.roiCi95[1] * 100)}`],
          ['Hit Rate (weighted)', `${(m.weightedHitRate * 100).toFixed(1)}%`],
          ['Avg Odds', num(m.averageOdds, 3)],
          ['Max Drawdown', num(m.maxDrawdown, 1)],
        ].map(([label, value]) => (
          <div key={label} className="p-3 rounded-lg bg-[#111827]/70 border border-[#1F2937]">
            <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{label}</div>
            <div className="text-white mt-1">{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
        <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className="bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-1.5 text-neutral-200">
          <option value="all">All AH lines</option>
          {lines.map((l) => (
            <option key={l} value={String(l)}>{l > 0 ? `+${l}` : l}</option>
          ))}
        </select>
        <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value)} className="bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-1.5 text-neutral-200">
          <option value="all">Home &amp; Away</option>
          <option value="home">Home</option>
          <option value="away">Away</option>
        </select>
        <select value={sampleFilter} onChange={(e) => setSampleFilter(e.target.value)} className="bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-1.5 text-neutral-200">
          <option value="eligible">Eligible for ranking (N ≥ 30)</option>
          <option value="all">All samples</option>
          <option value="STRONG_SAMPLE">Strong (300+)</option>
          <option value="MODERATE_SAMPLE">Moderate (100–299)</option>
          <option value="LOW_SAMPLE">Low (30–99)</option>
          <option value="INSUFFICIENT_SAMPLE">Insufficient (&lt;30)</option>
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-1.5 text-neutral-200">
          <option value="all">All value states</option>
          <option value="POSITIVE_VALUE">Positive value</option>
          <option value="NEGATIVE_VALUE">Negative value</option>
          <option value="NEUTRAL">Neutral</option>
          <option value="INSUFFICIENT_DATA">Insufficient data</option>
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)} className="bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-1.5 text-neutral-200">
          <option value="value">Sort: Value (default, sample-protected)</option>
          <option value="roi">Sort: ROI</option>
          <option value="ev">Sort: Model EV</option>
          <option value="probability">Sort: Probability</option>
          <option value="sample">Sort: Sample size</option>
        </select>
      </div>

      {/* Value table */}
      <div className="overflow-x-auto rounded-xl border border-[#1F2937]">
        <table className="w-full text-xs font-mono">
          <thead className="bg-[#0E1413] text-[#9CA3AF]">
            <tr>
              {['AH Line', 'Side', 'Bets', 'Hit Rate', 'Avg Odds', 'P&L', 'Yield', 'ROI 95% CI', 'Model P', 'Fair Odds', 'Model EV', 'Edge', 'Sample', 'State'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.line}-${r.side}`} className="border-t border-[#1F2937] hover:bg-[#111827]/50">
                <td className="px-3 py-2 text-white">{r.line > 0 ? `+${r.line}` : r.line}</td>
                <td className="px-3 py-2 text-neutral-300">{r.side}</td>
                <td className="px-3 py-2 text-neutral-300">{r.evaluatedBets}</td>
                <td className="px-3 py-2 text-neutral-300">{(r.weightedHitRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-neutral-300">{num(r.averageOdds, 3)}</td>
                <td className={`px-3 py-2 ${r.totalPnl >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>{num(r.totalPnl, 1)}</td>
                <td className={`px-3 py-2 ${r.yieldPct >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>{pct(r.yieldPct)}</td>
                <td className="px-3 py-2 text-neutral-400 whitespace-nowrap">[{pct(r.roiCi95[0] * 100)}, {pct(r.roiCi95[1] * 100)}]</td>
                <td className="px-3 py-2 text-neutral-300">{(r.modelProbability * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-neutral-300">{r.fairOdds === null ? 'N/A' : num(r.fairOdds, 3)}</td>
                <td className={`px-3 py-2 ${r.modelEvMean >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>{pct(r.modelEvMean * 100)}</td>
                <td className="px-3 py-2 text-neutral-400">{r.edgeMean === null ? 'N/A' : pct(r.edgeMean * 100)}</td>
                <td className={`px-3 py-2 ${SAMPLE_COLORS[r.sampleSizeStatus] ?? 'text-neutral-300'}`}>{r.sampleSizeStatus.replace('_SAMPLE', '')}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded border text-[10px] ${STATE_COLORS[r.valueState]}`}>{r.valueState}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-6 text-center text-[#9CA3AF]">
                  No line/side groups match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] font-mono text-[#6B7280]">
        Ranking default uses the lower 95% ROI bound (sample-size protected). Model probability/EV use the pooled
        posterior for the selected cohort (in-sample); see walk-forward below for out-of-sample results.
      </p>

      {/* Data health */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold font-display text-white">AH Data Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          {[
            ['Canonical matches', view.quality.canonicalMatches.toLocaleString('en-US')],
            ['Result coverage', `${view.quality.resultCoveragePct.toFixed(2)}%`],
            ['AH odds rows', view.quality.ahOddsRows.toLocaleString('en-US')],
            ['Canonical join', `${view.quality.canonicalJoinPct.toFixed(2)}%`],
            ['AH match coverage', `${view.quality.coverageMatches.toLocaleString('en-US')} (${view.quality.coveragePct.toFixed(2)}%)`],
            ['Valid observations', view.quality.validObservations.toLocaleString('en-US')],
            ['Duplicates collapsed', String(view.quality.duplicates)],
            ['Unmatched odds rows', String(view.quality.unmatchedRows)],
          ].map(([label, value]) => (
            <div key={label} className="p-3 rounded-lg bg-[#111827]/70 border border-[#1F2937]">
              <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{label}</div>
              <div className="text-white mt-1">{value}</div>
            </div>
          ))}
        </div>
        <div className="p-3 rounded-lg bg-[#111827]/70 border border-[#1F2937] text-xs font-mono">
          <span className="text-[#9CA3AF]">Timestamps: </span>
          <span className="text-amber-400">NO</span>
          <span className="text-[#9CA3AF]"> — {view.quality.timestampsNote}</span>
        </div>
        {view.quality.integrityFlags.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs font-mono text-amber-300 space-y-1">
            {view.quality.integrityFlags.map((f) => (
              <div key={f}>{f}</div>
            ))}
          </div>
        )}
      </section>

      {/* Walk-forward */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold font-display text-white">Walk-Forward (out-of-sample, season folds)</h2>
        <div className="overflow-x-auto rounded-xl border border-[#1F2937]">
          <table className="w-full text-xs font-mono">
            <thead className="bg-[#0E1413] text-[#9CA3AF]">
              <tr>
                {['Cohort', 'OOS Bets', 'All-Bets Yield', 'Positive-EV Bets', 'Positive-EV Yield', 'Brier', 'ECE', 'Positive Folds', 'Temporal Integrity'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.walkForward.map((wf) => (
                <tr key={wf.cohortKey} className="border-t border-[#1F2937]">
                  <td className="px-3 py-2 text-white">{wf.cohortKey}</td>
                  {wf.skipped ? (
                    <td colSpan={8} className="px-3 py-2 text-amber-400">{wf.skipped}</td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-neutral-300">{wf.testBets}</td>
                      <td className={`px-3 py-2 ${(wf.allBetsYieldPct ?? 0) >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>{pct(wf.allBetsYieldPct)}</td>
                      <td className="px-3 py-2 text-neutral-300">{wf.positiveEvBets}</td>
                      <td className={`px-3 py-2 ${(wf.positiveEvYieldPct ?? 0) >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>{pct(wf.positiveEvYieldPct)}</td>
                      <td className="px-3 py-2 text-neutral-300">{num(wf.meanBrier, 4)}</td>
                      <td className="px-3 py-2 text-neutral-300">{num(wf.meanEce, 4)}</td>
                      <td className="px-3 py-2 text-neutral-300">{wf.foldsWithPositiveValue}/{wf.foldsCount}</td>
                      <td className={`px-3 py-2 ${wf.temporalIntegrityFailures === 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                        {wf.temporalIntegrityFailures === 0 ? 'PASS' : `FAIL (${wf.temporalIntegrityFailures})`}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Limitations */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold font-display text-white">Limitations</h2>
        <ul className="space-y-1.5 text-xs font-mono text-[#9CA3AF]">
          {view.limitations.map((l) => (
            <li key={l} className="flex gap-2"><span className="text-amber-400">•</span>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
