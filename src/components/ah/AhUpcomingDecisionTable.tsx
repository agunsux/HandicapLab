'use client';

import React, { useState } from 'react';
import { Search, Filter, HelpCircle, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import type { UpcomingAhFixtureView, UpcomingAhResult } from '@/lib/services/ahUpcomingService';
import { AhCalculationTraceModal } from './AhCalculationTraceModal';

interface AhUpcomingDecisionTableProps {
  initialData: UpcomingAhResult;
}

export function AhUpcomingDecisionTable({ initialData }: AhUpcomingDecisionTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('ALL');
  const [selectedBadge, setSelectedBadge] = useState('ALL');
  const [inspectingFixture, setInspectingFixture] = useState<UpcomingAhFixtureView | null>(null);

  const fixtures = initialData?.fixtures || [];

  // Filter options
  const leagues = Array.from(new Set(fixtures.map((f) => f.leagueCode))).sort();

  const filtered = fixtures.filter((f) => {
    const matchStr = `${f.homeTeam} ${f.awayTeam} ${f.competition}`.toLowerCase();
    const matchesSearch = matchStr.includes(searchTerm.toLowerCase());
    const matchesLeague = selectedLeague === 'ALL' || f.leagueCode === selectedLeague;
    const matchesBadge = selectedBadge === 'ALL' || f.decisionHome.badge === selectedBadge;
    return matchesSearch && matchesLeague && matchesBadge;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search team or competition..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#111827] border border-[#1F2937] rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#10B981]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* League Filter */}
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="px-3 py-2 bg-[#111827] border border-[#1F2937] rounded-xl text-xs font-mono text-neutral-300 focus:outline-none focus:border-[#10B981]"
          >
            <option value="ALL">All Leagues</option>
            {leagues.map((lg) => (
              <option key={lg} value={lg}>
                {lg}
              </option>
            ))}
          </select>

          {/* Decision Badge Filter */}
          <select
            value={selectedBadge}
            onChange={(e) => setSelectedBadge(e.target.value)}
            className="px-3 py-2 bg-[#111827] border border-[#1F2937] rounded-xl text-xs font-mono text-neutral-300 focus:outline-none focus:border-[#10B981]"
          >
            <option value="ALL">All Decisions</option>
            <option value="GREEN">🟢 Value (Green)</option>
            <option value="YELLOW">🟡 Marginal (Yellow)</option>
            <option value="RED">🔴 No Value (Red)</option>
            <option value="GREY">⚪ Research / Insufficient (Grey)</option>
          </select>
        </div>
      </div>

      {/* Decision Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1F2937] bg-[#0E1413]">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1F2937] bg-[#111827]/80 text-neutral-400">
              <th className="py-3 px-4">MATCH</th>
              <th className="py-3 px-4">KICKOFF (UTC)</th>
              <th className="py-3 px-4">MARKET AH</th>
              <th className="py-3 px-4 text-right">MARKET ODDS</th>
              <th className="py-3 px-4 text-right">MODEL PROB</th>
              <th className="py-3 px-4 text-right">FAIR ODDS</th>
              <th className="py-3 px-4 text-right">EXPECTED VALUE</th>
              <th className="py-3 px-4 text-center">CONFIDENCE</th>
              <th className="py-3 px-4 text-center">STATUS</th>
              <th className="py-3 px-4 text-center">WHY?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2937]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-neutral-500">
                  No upcoming Asian Handicap fixtures matching the selected criteria.
                </td>
              </tr>
            ) : (
              filtered.map((f) => {
                const dec = f.decisionHome;
                return (
                  <tr key={f.canonicalFixtureId} className="hover:bg-[#111827]/50 transition-colors">
                    {/* Match */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white font-sans text-sm">
                        {f.homeTeam} <span className="text-neutral-500 font-normal">vs</span> {f.awayTeam}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">{f.competition}</div>
                    </td>

                    {/* Kickoff */}
                    <td className="py-3.5 px-4 text-neutral-300">
                      <div>{f.kickoffDate}</div>
                      <div className="text-[11px] text-neutral-500">{f.kickoffTime}</div>
                    </td>

                    {/* Market AH */}
                    <td className="py-3.5 px-4">
                      {f.marketAvailable && f.marketLine !== null ? (
                        <span className="font-bold text-[#10B981]">
                          AH {f.marketLine > 0 ? `+${f.marketLine}` : f.marketLine}
                        </span>
                      ) : (
                        <span className="text-neutral-500 italic">Unpublished</span>
                      )}
                    </td>

                    {/* Market Odds */}
                    <td className="py-3.5 px-4 text-right">
                      {f.homeOdds ? (
                        <span className="text-white font-bold">{f.homeOdds.toFixed(2)}</span>
                      ) : (
                        <span className="text-neutral-500">-</span>
                      )}
                    </td>

                    {/* Model Probability */}
                    <td className="py-3.5 px-4 text-right">
                      {f.modelProbHome !== null ? (
                        <span className="text-neutral-300">{f.modelProbHome}%</span>
                      ) : (
                        <span className="text-neutral-500">-</span>
                      )}
                    </td>

                    {/* Fair Odds */}
                    <td className="py-3.5 px-4 text-right">
                      {f.homeFairOdds ? (
                        <span className="text-[#10B981]">{f.homeFairOdds.toFixed(2)}</span>
                      ) : (
                        <span className="text-neutral-500">-</span>
                      )}
                    </td>

                    {/* Expected Value */}
                    <td className="py-3.5 px-4 text-right">
                      {f.homeEvPct !== null ? (
                        <span
                          className={`font-bold ${
                            f.homeEvPct > 0
                              ? 'text-[#10B981]'
                              : f.homeEvPct < 0
                              ? 'text-rose-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {f.homeEvPct > 0 ? `+${f.homeEvPct}%` : `${f.homeEvPct}%`}
                        </span>
                      ) : (
                        <span className="text-neutral-500">-</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-300">
                        {dec.confidence}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${dec.badgeColorClass}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {dec.status === 'VALUE'
                          ? 'VALUE'
                          : dec.status === 'MARGINAL'
                          ? 'MARGINAL'
                          : dec.status === 'NO_VALUE'
                          ? 'NO VALUE'
                          : dec.status === 'RESEARCH_ONLY'
                          ? 'RESEARCH'
                          : 'INSUFFICIENT'}
                      </span>
                    </td>

                    {/* Why? Button */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setInspectingFixture(f)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-[#1F2937] transition-colors"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-[#10B981]" />
                        <span>Why?</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Freshness & Provenance Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-neutral-500 px-1">
        <div>
          Data Source: <strong className="text-neutral-400">{initialData?.source || 'api-football / pinnacle'}</strong> &bull; Total Fixtures: <strong className="text-neutral-400">{initialData?.totalFixtures || 0}</strong>
        </div>
        <div>
          Last updated: <strong className="text-neutral-400">{initialData?.dataFreshness || 'Live'}</strong>
        </div>
      </div>

      {/* Trace Modal */}
      <AhCalculationTraceModal
        isOpen={Boolean(inspectingFixture)}
        onClose={() => setInspectingFixture(null)}
        upcomingFixture={inspectingFixture}
      />
    </div>
  );
}
