import React from 'react';
import { CANONICAL_15_LEAGUES } from '@/lib/config/multiLeagueRegistry';
import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';
import AdminLeaguesClient from './AdminLeaguesClient';

export const dynamic = 'force-dynamic';

export default async function AdminLeaguesPage() {
  const leagues = CANONICAL_15_LEAGUES;
  const quotaStatus = OddsPapiQuotaAllocator.loadState();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-mono">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Multi-League Governance & Registry
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                15 Candidate Portfolio
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              HandicapLab controlled expansion gate. Explicit non-boolean status lifecycle with deterministic failure reasons.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs bg-slate-900 border border-slate-800 p-3 rounded-lg">
            <div>
              <div className="text-slate-500 uppercase tracking-wider">OddsPapi Free Quota</div>
              <div className="font-semibold text-white mt-0.5">
                {quotaStatus.totalRemaining} / {quotaStatus.totalMonthlyBudget} remaining
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800 mx-2" />
            <div>
              <div className="text-slate-500 uppercase tracking-wider">Status</div>
              <div className={`font-semibold mt-0.5 ${quotaStatus.status === 'NORMAL' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {quotaStatus.status}
              </div>
            </div>
          </div>
        </div>

        {/* Client Interactive Table & Filter */}
        <AdminLeaguesClient leagues={leagues} quotaStatus={quotaStatus} />
      </div>
    </div>
  );
}

