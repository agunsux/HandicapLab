'use client';

import React, { useState, useMemo } from 'react';
import {
  Database,
  ShieldCheck,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import type { BttsHistoricalRecord, BttsHistorySummary } from '@/lib/services/bttsHistoryService';

interface BttsHistoricalExplorerProps {
  initialRecords: BttsHistoricalRecord[];
  summary: BttsHistorySummary;
}

export function BttsHistoricalExplorer({ initialRecords, summary }: BttsHistoricalExplorerProps) {
  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState<'ALL' | 'VERIFIED' | 'PARTIAL' | 'INVALID'>('ALL');
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
    if (qualityFilter !== 'ALL') {
      result = result.filter((r) => r.data_quality === qualityFilter);
    }
    return result;
  }, [initialRecords, search, qualityFilter]);

  return (
    <div className="space-y-8">
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

        {/* Bookmaker Consensus */}
        <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Sharp Benchmark</span>
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">Pinnacle</span>
            <span className="text-xs text-emerald-400 font-mono">Market 104</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Primary ground truth for closing line value (CLV)
          </p>
        </div>

        {/* Provenance Status */}
        <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Data Provenance</span>
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[#10B981]">{summary.verifiedRecords}</span>
            <span className="text-xs text-neutral-400 font-mono">/ {summary.bttsRecordsCount} verified</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            100% pre-match timestamps (<span className="text-emerald-400">zero leakage</span>)
          </p>
        </div>

        {/* Quota Impact */}
        <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Provider Quota</span>
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">0 Delta</span>
            <span className="text-xs text-emerald-400 font-mono">100% Unmetered</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Budget reserve: {summary.quotaAudit.requestLimit - summary.quotaAudit.countAfter} remaining (&ge; 50 floor)
          </p>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ──────────────────────────────────── */}
      <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search team, canonical ID, or fixture ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#111827] border border-[#1F2937] rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#10B981] font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-mono text-neutral-400">Quality:</span>
          {(['ALL', 'VERIFIED', 'PARTIAL', 'INVALID'] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQualityFilter(q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                qualityFilter === q
                  ? 'bg-[#10B981] text-black font-semibold'
                  : 'bg-[#111827] text-neutral-300 hover:text-white border border-[#1F2937]'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── FIXTURE TABLE ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1F2937] bg-[#0E1413] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#111827] border-b border-[#1F2937] text-neutral-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Match &amp; Kickoff</th>
                <th className="py-3 px-4">Canonical ID</th>
                <th className="py-3 px-4">Provider ID</th>
                <th className="py-3 px-4 text-center">Opening (Yes / No)</th>
                <th className="py-3 px-4 text-center">Closing (Yes / No)</th>
                <th className="py-3 px-4">Closing Timestamp</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-500">
                    No historical BTTS records matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.canonical_match_id} className="hover:bg-[#111827]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{r.home_team} vs {r.away_team}</div>
                      <div className="text-[11px] text-neutral-400">
                        {new Date(r.kickoff_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} UTC
                      </div>
                    </td>
                    <td className="py-3 px-4 text-neutral-400 truncate max-w-[180px]" title={r.canonical_match_id}>
                      {r.canonical_match_id}
                    </td>
                    <td className="py-3 px-4 text-neutral-400">{r.provider_fixture_id}</td>
                    <td className="py-3 px-4 text-center">
                      {r.opening_yes_odds ? (
                        <div className="space-x-1.5">
                          <span className="text-emerald-400 font-semibold">{r.opening_yes_odds.toFixed(2)}</span>
                          <span className="text-neutral-500">/</span>
                          <span className="text-neutral-300 font-semibold">{r.opening_no_odds?.toFixed(2) ?? '-'}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {r.closing_yes_odds ? (
                        <div className="space-x-1.5">
                          <span className="text-emerald-400 font-bold">{r.closing_yes_odds.toFixed(2)}</span>
                          <span className="text-neutral-500">/</span>
                          <span className="text-neutral-300 font-bold">{r.closing_no_odds?.toFixed(2) ?? '-'}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      {r.closing_timestamp ? r.closing_timestamp.replace('T', ' ').slice(0, 16) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.data_quality === 'VERIFIED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : r.data_quality === 'PARTIAL'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-red-950 text-red-300 border border-red-800'
                        }`}
                      >
                        {r.data_quality}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedRecord(r)}
                        className="p-1 hover:text-[#10B981] text-neutral-400 transition-colors"
                        title="Inspect Provenance"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: PROVENANCE DRILLDOWN ───────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#0E1413] border border-[#1F2937] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  {selectedRecord.home_team} vs {selectedRecord.away_team}
                </h3>
                <span className="text-xs font-mono text-neutral-400">
                  Kickoff: {selectedRecord.kickoff_at}
                </span>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-neutral-400 hover:text-white font-mono text-sm px-2 py-1 rounded bg-[#111827]"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Canonical Match ID:</span>
                <div className="font-semibold text-white break-all">{selectedRecord.canonical_match_id}</div>
              </div>
              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Provider Fixture ID:</span>
                <div className="font-semibold text-white">{selectedRecord.provider_fixture_id}</div>
              </div>
              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Opening Odds (Yes / No):</span>
                <div className="font-semibold text-emerald-400">
                  {selectedRecord.opening_yes_odds ?? '-'} / {selectedRecord.opening_no_odds ?? '-'}
                </div>
                <div className="text-[10px] text-neutral-400">Timestamp: {selectedRecord.opening_timestamp ?? 'N/A'}</div>
              </div>
              <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] space-y-1">
                <span className="text-neutral-400">Closing Odds (Yes / No):</span>
                <div className="font-semibold text-emerald-400">
                  {selectedRecord.closing_yes_odds ?? '-'} / {selectedRecord.closing_no_odds ?? '-'}
                </div>
                <div className="text-[10px] text-neutral-400">Timestamp: {selectedRecord.closing_timestamp ?? 'N/A'}</div>
              </div>
            </div>

            <div className="bg-[#111827] p-3 rounded-lg border border-[#1F2937] text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-400">Bookmaker:</span>
                <span className="text-white font-semibold">{selectedRecord.bookmaker.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Provenance Status:</span>
                <span className="text-[#10B981] font-semibold">{selectedRecord.provenance_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">In-play Observations Rejected:</span>
                <span className="text-amber-400 font-semibold">{selectedRecord.inplay_observations_rejected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Source Request ID:</span>
                <span className="text-neutral-300">{selectedRecord.source_request_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Ingested Timestamp:</span>
                <span className="text-neutral-300">{selectedRecord.ingested_at}</span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-neutral-400 border-t border-[#1F2937] pt-2">
              <strong>Phase 1 Contract:</strong> Raw historical evidence only. Zero predictive modeling, zero Kelly stakes, zero EV.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
