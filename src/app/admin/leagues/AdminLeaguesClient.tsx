'use client';

import React, { useState } from 'react';
import { MultiLeagueEntry, LeagueTier, ProductionStatus } from '@/lib/config/multiLeagueRegistry';
import { QuotaAllocationStatus } from '@/lib/providers/oddspapiQuotaAllocator';

interface AdminLeaguesClientProps {
  leagues: MultiLeagueEntry[];
  quotaStatus: QuotaAllocationStatus;
}

export default function AdminLeaguesClient({ leagues, quotaStatus }: AdminLeaguesClientProps) {
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeReasonModal, setActiveReasonModal] = useState<MultiLeagueEntry | null>(null);

  const filteredLeagues = leagues.filter((league) => {
    if (selectedTier !== 'ALL' && league.tier !== selectedTier) return false;
    if (selectedStatus !== 'ALL' && league.production_status !== selectedStatus) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const match =
        league.league_name.toLowerCase().includes(q) ||
        league.country.toLowerCase().includes(q) ||
        league.internal_league_id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const getStatusBadge = (status: ProductionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800';
      case 'SHADOW':
        return 'bg-blue-950 text-blue-400 border-blue-800';
      case 'DISCOVERY':
        return 'bg-amber-950 text-amber-400 border-amber-800';
      case 'PAUSED':
        return 'bg-purple-950 text-purple-400 border-purple-800';
      case 'DISABLED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getTierBadge = (tier: LeagueTier) => {
    switch (tier) {
      case 'A':
        return 'bg-red-950/60 text-red-400 border-red-800';
      case 'B':
        return 'bg-indigo-950/60 text-indigo-400 border-indigo-800';
      case 'C':
        return 'bg-cyan-950/60 text-cyan-400 border-cyan-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 uppercase">Candidate Universe</div>
          <div className="text-2xl font-bold text-white mt-1">15 Candidates</div>
          <div className="text-xs text-slate-400 mt-1">5 Tier A • 5 Tier B • 5 Tier C</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 uppercase">Production Active</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {leagues.filter((l) => l.production_status === 'ACTIVE').length} Active
          </div>
          <div className="text-xs text-slate-400 mt-1">Fully verified with Pinnacle odds</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 uppercase">Shadow Ingestion</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {leagues.filter((l) => l.production_status === 'SHADOW').length} Shadow
          </div>
          <div className="text-xs text-slate-400 mt-1">Phase-gated & evaluation pipelines</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 uppercase">Data Gated / Incomplete</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {leagues.filter((l) => l.non_active_reason.includes('DATA_COMPLETENESS')).length} Gated
          </div>
          <div className="text-xs text-slate-400 mt-1">e.g. IDN-L1 stats missing in API-Football</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-slate-900/60 p-4 rounded-lg border border-slate-800">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'A', 'B', 'C'].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1.5 text-xs rounded font-semibold transition-colors ${
                selectedTier === tier
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Tier {tier}
            </button>
          ))}
          <div className="h-6 w-px bg-slate-700 mx-1 self-center" />
          {['ALL', 'ACTIVE', 'SHADOW', 'DISCOVERY', 'PAUSED'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1.5 text-xs rounded font-semibold transition-colors ${
                selectedStatus === status
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div>
          <input
            type="text"
            placeholder="Search league, country, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Main Governance Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="p-3">League</th>
              <th className="p-3">Country</th>
              <th className="p-3">Tier</th>
              <th className="p-3">Status</th>
              <th className="p-3">API-Football ID</th>
              <th className="p-3">OddsPapi ID</th>
              <th className="p-3">Season</th>
              <th className="p-3">Upcoming 7D</th>
              <th className="p-3">Finished</th>
              <th className="p-3">Odds Cov.</th>
              <th className="p-3">Pinnacle</th>
              <th className="p-3">AH</th>
              <th className="p-3">OU</th>
              <th className="p-3">BTTS</th>
              <th className="p-3">Model</th>
              <th className="p-3">Completeness</th>
              <th className="p-3">Priority Score</th>
              <th className="p-3 text-right">Gate Diagnostic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredLeagues.map((league) => {
              const isNotActive = league.production_status !== 'ACTIVE';
              return (
                <tr key={league.internal_league_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 font-semibold text-white">
                    <div>{league.display_name}</div>
                    <div className="text-[10px] text-slate-500">{league.internal_league_id}</div>
                  </td>
                  <td className="p-3 text-slate-300">{league.country}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getTierBadge(league.tier)}`}>
                      Tier {league.tier}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getStatusBadge(league.production_status)}`}>
                      {league.production_status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">{league.provider_league_id}</td>
                  <td className="p-3 text-slate-300">{league.oddspapi_tournament_id}</td>
                  <td className="p-3 text-slate-300">{league.current_season}</td>
                  <td className="p-3 text-slate-300">{league.upcoming_7day_fixture_count}</td>
                  <td className="p-3 text-slate-300">{league.finished_match_count}</td>
                  <td className="p-3">
                    <span className={league.odds_availability ? 'text-emerald-400' : 'text-slate-500'}>
                      {league.odds_availability ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={league.pinnacle_availability ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                      {league.pinnacle_availability ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={league.supported_ah_availability ? 'text-emerald-400' : 'text-slate-500'}>
                      {league.supported_ah_availability ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={league.supported_ou_availability ? 'text-emerald-400' : 'text-slate-500'}>
                      {league.supported_ou_availability ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={league.supported_btts_inputs ? 'text-emerald-400' : 'text-slate-500'}>
                      {league.supported_btts_inputs ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={league.model_eligibility ? 'text-emerald-400' : 'text-amber-400'}>
                      {league.model_eligibility ? 'READY' : 'INSUFFICIENT'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            league.data_completeness >= 90
                              ? 'bg-emerald-500'
                              : league.data_completeness >= 70
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${league.data_completeness}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-300">{league.data_completeness}%</span>
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-cyan-400">{league.priority_score}</td>
                  <td className="p-3 text-right">
                    {isNotActive ? (
                      <button
                        onClick={() => setActiveReasonModal(league)}
                        className="px-2 py-1 text-[10px] rounded bg-amber-950/80 text-amber-300 border border-amber-800 hover:bg-amber-900 transition-colors"
                      >
                        Why not ACTIVE?
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-semibold px-2 py-1 bg-emerald-950/50 rounded border border-emerald-900">
                        ACTIVE QUALIFIED
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Deterministic Reason Code Modal */}
      {activeReasonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Activation Gate Diagnostic
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  {activeReasonModal.display_name} ({activeReasonModal.internal_league_id})
                </div>
              </div>
              <button
                onClick={() => setActiveReasonModal(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="text-slate-500 uppercase text-[10px] tracking-wider">Deterministic Reason Code</div>
                <div className="text-amber-400 font-bold text-sm mt-0.5">
                  {activeReasonModal.non_active_reason}
                </div>
              </div>

              <div className="space-y-2 text-slate-300">
                <div className="font-semibold text-white">Audit Finding Details:</div>
                {activeReasonModal.non_active_reason === 'NOT_ACTIVE: DATA_COMPLETENESS_FAIL' && (
                  <p className="text-rose-300 bg-rose-950/40 p-2.5 rounded border border-rose-900">
                    API-Football PRO explicitly reports <code className="text-rose-200">statistics_fixtures = false</code> for this competition. Match xG, shots, and dynamic team defense indicators cannot be generated without real provider statistics. Additionally, OddsPapi lacks verified Pinnacle market lines for this tournament.
                  </p>
                )}
                {activeReasonModal.non_active_reason === 'NOT_ACTIVE: PHASE_GATED' && (
                  <p className="text-blue-300 bg-blue-950/40 p-2.5 rounded border border-blue-900">
                    This league successfully resolves all provider IDs and data completeness requirements. Under the Multi-League Expansion rollout policy, it is currently placed in <span className="font-bold">SHADOW</span> mode for reconciliation and quota-conscious odds validation prior to final promotion to ACTIVE.
                  </p>
                )}
                {activeReasonModal.non_active_reason === 'NOT_ACTIVE: PINNACLE_UNAVAILABLE' && (
                  <p className="text-amber-300 bg-amber-950/40 p-2.5 rounded border border-amber-900">
                    OddsPapi does not return Pinnacle sharp reference prices for this competition. Sharp market reference is mandatory for model de-vigging and Closing Line Value (CLV) evaluation.
                  </p>
                )}
                {activeReasonModal.non_active_reason === 'NOT_ACTIVE: INSUFFICIENT_MODEL_SAMPLE' && (
                  <p className="text-amber-300 bg-amber-950/40 p-2.5 rounded border border-amber-900">
                    Teams in this competition have not accumulated the required minimum 3 completed matches in historical records for Dixon-Coles parameter stability.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500">API-Football ID:</span> {activeReasonModal.provider_league_id}
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500">OddsPapi ID:</span> {activeReasonModal.oddspapi_tournament_id}
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500">Pinnacle Ready:</span> {activeReasonModal.pinnacle_availability ? 'Yes' : 'No'}
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500">Model Eligible:</span> {activeReasonModal.model_eligibility ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveReasonModal(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

