'use client';

import { useEffect, useRef, useState } from 'react';
import { Filter, ChevronLeft, ChevronRight, Eye, ShieldCheck, TrendingUp, Info } from 'lucide-react';
import type { AhBetObservation } from '@/lib/research/ah-yield/ahTypes';
import type {
  AhAvailableFilters,
  AhHistoryQueryResult,
  MatchCalculationTrace,
} from '@/lib/research/ah-yield/ahHistoryContracts';
import { AhCalculationTraceModal } from './AhCalculationTraceModal';

interface AhHistoricalExplorerProps {
  initialResult: AhHistoryQueryResult;
  availableFilters: AhAvailableFilters;
}

export function AhHistoricalExplorer({ initialResult, availableFilters }: AhHistoricalExplorerProps) {
  // State for active filters
  const [selectedLeague, setSelectedLeague] = useState<string>('ENG-PL');
  const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedSide, setSelectedSide] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedProvenance, setSelectedProvenance] = useState<string>('ALL');
  const [page, setPage] = useState<number>(0);
  const pageSize = 25;

  const [inspectingTrace, setInspectingTrace] = useState<MatchCalculationTrace | null>(null);
  const [queryResult, setQueryResult] = useState<AhHistoryQueryResult>(initialResult);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  // Query execution goes through the server route (/api/ah/history) so the
  // client never imports the fs-backed AhHistoryService dependency chain.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (selectedLeague && selectedLeague !== 'ALL') params.set('league', selectedLeague);
    if (selectedSeason && selectedSeason !== 'ALL') params.set('season', selectedSeason);
    if (selectedLine !== 'ALL') params.set('line', selectedLine);
    if (selectedSide !== 'ALL') params.set('side', selectedSide);
    if (selectedRole !== 'ALL') params.set('favoriteStatus', selectedRole);
    if (selectedProvenance !== 'ALL') params.set('provenance', selectedProvenance);
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));

    setIsLoading(true);
    setQueryError(null);

    fetch(`/api/ah/history?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `Request failed (${res.status})`);
        }
        return json.data as AhHistoryQueryResult;
      })
      .then((data) => setQueryResult(data))
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setQueryError(err instanceof Error ? err.message : 'Failed to load historical data');
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [selectedLeague, selectedSeason, selectedLine, selectedSide, selectedRole, selectedProvenance, page]);

  const { summary, observations, totalMatchesAvailable, datasetUpdated } = queryResult;
  const totalPages = Math.ceil(totalMatchesAvailable / pageSize);

  const handleOpenCalculation = async (obs: AhBetObservation) => {
    try {
      const res = await fetch(`/api/ah/matches/${encodeURIComponent(obs.observationId)}`);
      const json = await res.json();
      if (res.ok && json?.success && json.data) {
        setInspectingTrace(json.data as MatchCalculationTrace);
      }
    } catch {
      // Trace is optional; keep the modal closed on failure.
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="p-5 rounded-2xl bg-[#0E1413] border border-[#1F2937] space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#10B981] uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" />
          Multi-Dimensional Historical Filters
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          {/* League */}
          <div>
            <label className="block text-neutral-400 mb-1">League</label>
            <select
              value={selectedLeague}
              onChange={(e) => {
                setSelectedLeague(e.target.value);
                setPage(0);
              }}
              className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1F2937] rounded-lg text-white focus:outline-none focus:border-[#10B981]"
            >
              <option value="ALL">All Leagues</option>
              {availableFilters.leagues.map((lg) => (
                <option key={lg.id} value={lg.id}>
                  {lg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Season */}
          <div>
            <label className="block text-neutral-400 mb-1">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) => {
                setSelectedSeason(e.target.value);
                setPage(0);
              }}
              className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1F2937] rounded-lg text-white focus:outline-none focus:border-[#10B981]"
            >
              <option value="ALL">All Seasons</option>
              {availableFilters.seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Line */}
          <div>
            <label className="block text-neutral-400 mb-1">AH Line</label>
            <select
              value={selectedLine}
              onChange={(e) => {
                setSelectedLine(e.target.value);
                setPage(0);
              }}
              className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1F2937] rounded-lg text-white focus:outline-none focus:border-[#10B981]"
            >
              <option value="ALL">All Lines</option>
              {availableFilters.lines.map((l) => (
                <option key={l} value={l}>
                  {l > 0 ? `+${l}` : l}
                </option>
              ))}
            </select>
          </div>

          {/* Side */}
          <div>
            <label className="block text-neutral-400 mb-1">Side</label>
            <select
              value={selectedSide}
              onChange={(e) => {
                setSelectedSide(e.target.value);
                setPage(0);
              }}
              className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1F2937] rounded-lg text-white focus:outline-none focus:border-[#10B981]"
            >
              <option value="ALL">Home &amp; Away</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </div>

          {/* Role */}
          <div>
            <label className="block text-neutral-400 mb-1">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(0);
              }}
              className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1F2937] rounded-lg text-white focus:outline-none focus:border-[#10B981]"
            >
              <option value="ALL">All Roles</option>
              <option value="favorite">Favorite</option>
              <option value="underdog">Underdog</option>
              <option value="market_neutral">Neutral</option>
            </select>
          </div>

          {/* Odds Source */}
          <div>
            <label className="block text-neutral-400 mb-1">Odds Source</label>
            <select
              value={selectedProvenance}
              onChange={(e) => {
                setSelectedProvenance(e.target.value);
                setPage(0);
              }}
              className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1F2937] rounded-lg text-white focus:outline-none focus:border-[#10B981]"
            >
              <option value="ALL">All Sources</option>
              {availableFilters.provenances.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Sample & Confidence */}
        <div className="p-4 rounded-xl bg-[#0E1413] border border-[#1F2937]">
          <div className="text-xs text-neutral-400 font-mono">Sample Size</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{summary.sampleSize}</div>
          <div className="text-[11px] font-mono text-[#10B981] mt-0.5">{summary.sampleStatus}</div>
        </div>

        {/* Realized ROI */}
        <div className="p-4 rounded-xl bg-[#0E1413] border border-[#1F2937]">
          <div className="text-xs text-neutral-400 font-mono">Realized Yield / ROI</div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              summary.yieldRoiPct > 0 ? 'text-[#10B981]' : summary.yieldRoiPct < 0 ? 'text-rose-400' : 'text-neutral-400'
            }`}
          >
            {summary.yieldRoiPct > 0 ? `+${summary.yieldRoiPct}%` : `${summary.yieldRoiPct}%`}
          </div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">Historical Return</div>
        </div>

        {/* Hit Rate */}
        <div className="p-4 rounded-xl bg-[#0E1413] border border-[#1F2937]">
          <div className="text-xs text-neutral-400 font-mono">Hit Rate</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{summary.hitRatePct}%</div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">Win pts / Decided</div>
        </div>

        {/* Net P&L */}
        <div className="p-4 rounded-xl bg-[#0E1413] border border-[#1F2937]">
          <div className="text-xs text-neutral-400 font-mono">Total P&amp;L</div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              summary.totalPnl > 0 ? 'text-[#10B981]' : summary.totalPnl < 0 ? 'text-rose-400' : 'text-neutral-400'
            }`}
          >
            {summary.totalPnl > 0 ? `+${summary.totalPnl} u` : `${summary.totalPnl} u`}
          </div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">1-unit stakes</div>
        </div>

        {/* Average Odds */}
        <div className="p-4 rounded-xl bg-[#0E1413] border border-[#1F2937]">
          <div className="text-xs text-neutral-400 font-mono">Avg Odds</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{summary.averageOdds.toFixed(3)}</div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">Decimal Mean</div>
        </div>

        {/* Max Drawdown */}
        <div className="p-4 rounded-xl bg-[#0E1413] border border-[#1F2937]">
          <div className="text-xs text-neutral-400 font-mono">Max Drawdown</div>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">-{summary.maxDrawdownPct}%</div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">Peak-to-Trough</div>
        </div>
      </div>

      {/* Outcome Distribution Bar */}
      <div className="p-4 rounded-xl bg-[#0E1413] border border-[#1F2937] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-neutral-400">Full Win: </span>
            <strong className="text-[#10B981]">{summary.fullWins}</strong>
          </div>
          <div>
            <span className="text-neutral-400">Half Win: </span>
            <strong className="text-[#10B981]">{summary.halfWins}</strong>
          </div>
          <div>
            <span className="text-neutral-400">Push: </span>
            <strong className="text-neutral-300">{summary.pushes}</strong>
          </div>
          <div>
            <span className="text-neutral-400">Half Loss: </span>
            <strong className="text-amber-400">{summary.halfLosses}</strong>
          </div>
          <div>
            <span className="text-neutral-400">Full Loss: </span>
            <strong className="text-rose-400">{summary.fullLosses}</strong>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded bg-black/40 border border-neutral-800 text-neutral-400">
          Status: <strong className="text-white">{summary.historicalStatusLabel}</strong>
        </div>
      </div>

      {/* Observation Ledger Table */}
      <div className="space-y-2">
        {(isLoading || queryError) && (
          <div className="text-xs font-mono px-1">
            {isLoading ? (
              <span className="text-neutral-400">Loading historical data…</span>
            ) : (
              <span className="text-rose-400">Error: {queryError}</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between text-xs font-mono text-neutral-400 px-1">
          <div>
            Showing <strong className="text-white">{observations.length}</strong> of{' '}
            <strong className="text-white">{totalMatchesAvailable}</strong> matched bets
          </div>
          <div>
            Page {page + 1} of {Math.max(1, totalPages)}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#1F2937] bg-[#0E1413]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1F2937] bg-[#111827]/80 text-neutral-400">
                <th className="py-3 px-4">DATE</th>
                <th className="py-3 px-4">MATCH</th>
                <th className="py-3 px-4 text-center">SCORE</th>
                <th className="py-3 px-4">SIDE</th>
                <th className="py-3 px-4">AH LINE</th>
                <th className="py-3 px-4 text-right">ODDS</th>
                <th className="py-3 px-4">SETTLEMENT</th>
                <th className="py-3 px-4 text-right">P&amp;L</th>
                <th className="py-3 px-4 text-center">CALCULATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]">
              {observations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-500">
                    No historical matches match the selected criteria.
                  </td>
                </tr>
              ) : (
                observations.map((o) => (
                  <tr key={o.observationId} className="hover:bg-[#111827]/50 transition-colors">
                    <td className="py-3 px-4 text-neutral-400">{o.matchDate}</td>
                    <td className="py-3 px-4 font-sans font-medium text-white">
                      {o.homeTeam} vs {o.awayTeam}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-neutral-200">
                      {o.homeScore} - {o.awayScore}
                    </td>
                    <td className="py-3 px-4 capitalize text-neutral-300">{o.side}</td>
                    <td className="py-3 px-4 font-bold text-[#10B981]">
                      {o.selectionLine > 0 ? `+${o.selectionLine}` : o.selectionLine}
                    </td>
                    <td className="py-3 px-4 text-right text-white">{o.odds.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          o.settlement.includes('WIN')
                            ? 'bg-emerald-500/10 text-[#10B981] border border-emerald-500/20'
                            : o.settlement.includes('LOSS')
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                        }`}
                      >
                        {o.settlement}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        o.pnl > 0 ? 'text-[#10B981]' : o.pnl < 0 ? 'text-rose-400' : 'text-neutral-400'
                      }`}
                    >
                      {o.pnl > 0 ? `+${o.pnl.toFixed(2)}` : o.pnl.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenCalculation(o)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#111827] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-[#1F2937] transition-colors"
                      >
                        <Eye className="h-3 w-3 text-[#10B981]" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between py-2 text-xs font-mono">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111827] disabled:opacity-30 text-neutral-300 hover:text-white border border-[#1F2937] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-neutral-400">
            Page {page + 1} of {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111827] disabled:opacity-30 text-neutral-300 hover:text-white border border-[#1F2937] transition-colors"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Freshness Note */}
      <div className="text-xs font-mono text-neutral-500 text-right">
        Historical dataset verified: <strong className="text-neutral-400">{datasetUpdated}</strong>
      </div>

      {/* Trace Modal */}
      <AhCalculationTraceModal
        isOpen={Boolean(inspectingTrace)}
        onClose={() => setInspectingTrace(null)}
        historicalTrace={inspectingTrace}
      />
    </div>
  );
}
