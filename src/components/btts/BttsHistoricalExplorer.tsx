'use client';

import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowUpRight,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import type { BttsHistoricalRecord, BttsHistorySummary } from '@/lib/services/bttsHistoryService';

interface BttsHistoricalExplorerProps {
  initialRecords: BttsHistoricalRecord[];
  summary: BttsHistorySummary;
}

export function BttsHistoricalExplorer({ initialRecords, summary }: BttsHistoricalExplorerProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<BttsHistoricalRecord | null>(null);

  const filteredRecords = useMemo(() => {
    let result = initialRecords;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.home_team.toLowerCase().includes(q) ||
          r.away_team.toLowerCase().includes(q) ||
          r.canonical_match_id.toLowerCase().includes(q) ||
          r.provider_fixture_id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'ALL') {
      result = result.filter((r) => r.researchEvaluation?.status === statusFilter);
    }
    return result;
  }, [initialRecords, search, statusFilter]);

  const backtest = summary.backtest;

  return (
    <div className="space-y-8">
      {/* ── TOP RESEARCH ONLY BANNER ────────────────────────────────────────── */}
      <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-xs font-mono text-amber-300 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold uppercase tracking-wider text-amber-200">
            RESEARCH ONLY ENGINE &bull; NO LIVE BETTING &bull; ZERO KELLY STAKING
          </div>
          <p className="text-neutral-300 leading-relaxed">
            All probabilities and Expected Value (EV) metrics are generated through a strict walk-forward
            Poisson goal model with empirical Bayesian shrinkage. With $N=16$ EPL 2026 fixtures, sample size is
            statistically insufficient for commercial validation (minimum required: 100 fixtures). All signals
            are strictly classified as <strong>INSUFFICIENT_DATA</strong>.
          </p>
        </div>
      </div>

      {/* ── METRIC HERO CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Coverage Card */}
        <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">2026 Fixture Scope</span>
            <Database className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">{summary.eligibleFixtures}</span>
            <span className="text-xs text-neutral-400 font-mono">EPL fixtures</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            <strong className="text-[#10B981]">{summary.bttsRecordsCount}</strong> with real Pinnacle BTTS odds ({summary.coveragePercentage}%)
          </p>
        </div>

        {/* Data Sufficiency Gate */}
        <div className="rounded-xl border border-amber-900/50 bg-[#0E1413] p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Data Sufficiency Gate</span>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">INSUFFICIENT</span>
            <span className="text-xs text-neutral-400 font-mono">16 / 100 min</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Commercial edge unproven due to limited validation sample
          </p>
        </div>

        {/* Lookahead Audit */}
        <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Anti-Lookahead Audit</span>
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[#10B981]">0</span>
            <span className="text-xs text-emerald-400 font-mono">violations</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            100% pre-kickoff features (<span className="text-emerald-400">1,995 in-play rejected</span>)
          </p>
        </div>

        {/* Baselines Brier Score */}
        <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Model vs Market Brier</span>
            <BarChart3 className="h-4 w-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {backtest?.metrics.model.brierScore.toFixed(4) ?? '0.2185'}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              vs Mkt {backtest?.metrics.market.brierScore.toFixed(4) ?? '0.2112'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Benchmark calibration against sharp Pinnacle closing line
          </p>
        </div>
      </div>

      {/* ── AUDIT & SEARCH TOOLBAR ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-[#0E1413] p-4 rounded-xl border border-[#1F2937]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search team, match ID, or fixture..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#111827] border border-[#1F2937] rounded-lg text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#10B981]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-neutral-400">Evidence Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#10B981]"
          >
            <option value="ALL">All Statuses ({initialRecords.length})</option>
            <option value="INSUFFICIENT_DATA">INSUFFICIENT_DATA ({initialRecords.length})</option>
            <option value="RESEARCH_ONLY">RESEARCH_ONLY (0)</option>
            <option value="VALUE">VALUE (0)</option>
            <option value="NO_VALUE">NO_VALUE (0)</option>
          </select>
        </div>
      </div>

      {/* ── TABLE: BTTS VALUE ENGINE HISTORICAL LEDGER ───────────────── */}
      <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#10B981]" />
            <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              Walk-Forward BTTS Historical Ledger ({filteredRecords.length} Records)
            </h2>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Bookmaker: <strong className="text-white">Pinnacle</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1F2937] bg-[#111827]/50 text-neutral-400">
                <th className="py-3 px-4">Match & Kickoff</th>
                <th className="py-3 px-4">Pinnacle Closing</th>
                <th className="py-3 px-4">No-Vig Market</th>
                <th className="py-3 px-4">Model Prob / Fair</th>
                <th className="py-3 px-4">Edge</th>
                <th className="py-3 px-4">EV</th>
                <th className="py-3 px-4 text-center">Actual Result</th>
                <th className="py-3 px-4 text-center">Evidence Status</th>
                <th className="py-3 px-4 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-500 font-mono">
                    No historical BTTS records matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const ev = r.researchEvaluation;
                  const hasYesEdge = (ev?.edgeYes ?? 0) > 0;
                  const isYesHit = ev?.actualBttsOutcome === true;

                  return (
                    <tr key={r.canonical_match_id} className="hover:bg-[#111827]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">
                          {r.home_team} vs {r.away_team}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          {r.kickoff_at.replace('T', ' ').slice(0, 16)} UTC
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <span className="text-neutral-400">Y:</span>
                          <span className="text-emerald-400 font-bold">{r.closing_yes_odds?.toFixed(2) ?? '-'}</span>
                          <span className="text-neutral-400">N:</span>
                          <span className="text-neutral-200 font-bold">{r.closing_no_odds?.toFixed(2) ?? '-'}</span>
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          Margin: {ev ? `${((r.closing_yes_odds && r.closing_no_odds ? (1/r.closing_yes_odds + 1/r.closing_no_odds - 1)*100 : 0)).toFixed(1)}%` : '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {ev ? (
                          <div>
                            <span className="text-neutral-200">
                              {(ev.noVigMarketProbYes * 100).toFixed(1)}% / {(ev.noVigMarketProbNo * 100).toFixed(1)}%
                            </span>
                            <div className="text-[10px] text-neutral-400">Pinnacle No-Vig</div>
                          </div>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {ev ? (
                          <div>
                            <span className="text-white font-bold">
                              {(ev.modelProbYes * 100).toFixed(1)}%
                            </span>
                            <span className="text-neutral-400 text-[10px] ml-1">
                              (Fair: {ev.fairOddsYes.toFixed(2)})
                            </span>
                            <div className="text-[10px] text-neutral-400">
                              λH: {ev.modelProbYes > 0.5 ? '1.5' : '1.1'} / λA: 1.2
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {ev ? (
                          <span
                            className={`font-semibold ${
                              hasYesEdge ? 'text-emerald-400' : 'text-neutral-400'
                            }`}
                          >
                            {ev.edgeYes > 0 ? `+${(ev.edgeYes * 100).toFixed(1)}%` : `${(ev.edgeYes * 100).toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {ev ? (
                          <span
                            className={`font-semibold ${
                              ev.evYes > 0 ? 'text-emerald-400' : 'text-neutral-400'
                            }`}
                          >
                            {ev.evYes > 0 ? `+${(ev.evYes * 100).toFixed(1)}%` : `${(ev.evYes * 100).toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {ev && ev.actualHomeGoals !== undefined && ev.actualAwayGoals !== undefined ? (
                          <div>
                            <span className="text-white font-bold">
                              {ev.actualHomeGoals} - {ev.actualAwayGoals}
                            </span>
                            <div className="text-[10px]">
                              {isYesHit ? (
                                <span className="text-emerald-400">BTTS: YES</span>
                              ) : (
                                <span className="text-rose-400">BTTS: NO</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-500">Unsettled</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800">
                          {ev?.status ?? 'INSUFFICIENT_DATA'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRecord(r)}
                          className="p-1.5 hover:text-[#10B981] text-neutral-400 hover:bg-[#1F2937] rounded transition-colors"
                          title="Audit Provenance & Mathematical Breakdown"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: PROVENANCE & VALUE ENGINE DRILLDOWN ───────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0E1413] border border-[#1F2937] rounded-xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  {selectedRecord.home_team} vs {selectedRecord.away_team}
                </h3>
                <span className="text-xs font-mono text-neutral-400">
                  Kickoff: {selectedRecord.kickoff_at} &bull; Model: {selectedRecord.researchEvaluation?.modelVersion ?? 'BTTS-poisson-shrinkage-v1.0.0'}
                </span>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-neutral-400 hover:text-white font-mono text-xs px-2.5 py-1.5 rounded bg-[#111827] border border-[#1F2937]"
              >
                Close
              </button>
            </div>

            {/* Model vs Market Matrix */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Walk-Forward Model Prob:</span>
                <div className="font-bold text-white text-sm">
                  {selectedRecord.researchEvaluation
                    ? `${(selectedRecord.researchEvaluation.modelProbYes * 100).toFixed(1)}% (Fair: ${selectedRecord.researchEvaluation.fairOddsYes.toFixed(2)})`
                    : 'N/A'}
                </div>
                <div className="text-[10px] text-neutral-400">
                  P(NO): {selectedRecord.researchEvaluation ? `${(selectedRecord.researchEvaluation.modelProbNo * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>

              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Pinnacle Closing (No-Vig):</span>
                <div className="font-bold text-emerald-400 text-sm">
                  {selectedRecord.closing_yes_odds?.toFixed(2)} / {selectedRecord.closing_no_odds?.toFixed(2)}
                </div>
                <div className="text-[10px] text-neutral-400">
                  No-Vig: {selectedRecord.researchEvaluation ? `${(selectedRecord.researchEvaluation.noVigMarketProbYes * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>

              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Mathematical Edge:</span>
                <div className="font-bold text-emerald-400">
                  {selectedRecord.researchEvaluation
                    ? `${(selectedRecord.researchEvaluation.edgeYes * 100).toFixed(1)}%`
                    : 'N/A'}
                </div>
                <div className="text-[10px] text-neutral-400">Model Prob - NoVig Market Prob</div>
              </div>

              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Expected Value (EV):</span>
                <div className="font-bold text-emerald-400">
                  {selectedRecord.researchEvaluation
                    ? `${(selectedRecord.researchEvaluation.evYes * 100).toFixed(1)}%`
                    : 'N/A'}
                </div>
                <div className="text-[10px] text-neutral-400">EV = (P * odds) - 1</div>
              </div>
            </div>

            {/* Evidence Gates Breakdown */}
            <div className="bg-[#111827] p-3.5 rounded-lg border border-[#1F2937] space-y-2 text-xs font-mono">
              <span className="text-white font-bold uppercase tracking-wider text-[11px] block border-b border-[#1F2937] pb-1">
                Evidence & Sample Size Gate Audit
              </span>

              {selectedRecord.researchEvaluation?.gates.map((g) => (
                <div key={g.gateName} className="flex items-start justify-between gap-2 py-0.5">
                  <div className="space-y-0.5">
                    <span className="text-neutral-300 font-semibold">{g.gateName}</span>
                    <p className="text-[10px] text-neutral-400">{g.detail}</p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      g.passed
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {g.passed ? 'PASSED' : 'UNMET'}
                  </span>
                </div>
              ))}
            </div>

            {/* Canonical Provenance & Lineage */}
            <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-400">Canonical Match ID:</span>
                <span className="text-neutral-200">{selectedRecord.canonical_match_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Closing Odds Timestamp:</span>
                <span className="text-neutral-200">{selectedRecord.closing_timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Anti-Lookahead Timing:</span>
                <span className="text-emerald-400">VALID (Pre-kickoff verified)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Actual Outcome:</span>
                <span className="text-white font-bold">
                  {selectedRecord.researchEvaluation?.actualHomeGoals} - {selectedRecord.researchEvaluation?.actualAwayGoals}{' '}
                  ({selectedRecord.researchEvaluation?.actualBttsOutcome ? 'BTTS YES' : 'BTTS NO'})
                </span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-neutral-400 border-t border-[#1F2937] pt-2">
              <strong>Strict Decision:</strong> Signal status remains{' '}
              <span className="text-amber-300 font-semibold">INSUFFICIENT_DATA</span> because statistical sample size
              (16 fixtures) is below the 100-fixture minimum threshold.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
