'use client';

import React, { useState } from 'react';
import { TerminalPrediction } from '@/lib/terminalData';
import { ResearchBanner } from '@/components/terminal/ResearchBanner';
import { PredictionCard } from '@/components/terminal/PredictionCard';
import { Database, Filter, ArrowUpDown } from 'lucide-react';

interface PredictionsViewProps {
  initialPredictions: TerminalPrediction[];
}

export function PredictionsView({ initialPredictions }: PredictionsViewProps) {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'settled'>('all');
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');

  const leagues = Array.from(new Set(initialPredictions.map((p) => p.league_name))).filter(Boolean);

  const filtered = initialPredictions.filter((p) => {
    if (filter === 'upcoming' && p.settlement_status !== 'PENDING') return false;
    if (filter === 'settled' && p.settlement_status !== 'SETTLED') return false;
    if (leagueFilter !== 'ALL' && p.league_name !== leagueFilter) return false;
    return true;
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-8 pb-16 flex-1">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] text-xs font-mono text-amber-400 mb-2">
          <Database className="h-3.5 w-3.5" />
          RESEARCH PREDICTIONS REGISTRY
        </div>
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">
          Model Prediction Ledger
        </h1>
        <p className="text-sm text-[#9CA3AF] mt-1 max-w-2xl">
          Point-in-time predictions generated prior to match kickoff. Full audit trail of fair probabilities, closing lines, and settlement outcomes.
        </p>
      </div>

      {/* RESEARCH HONESTY BANNER */}
      <ResearchBanner />

      {/* Filter Tabs & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 my-6 bg-[#111827]/60 border border-[#1F2937] p-3 rounded-xl">
        <div className="flex items-center gap-1.5 bg-[#0B0F0E] p-1 rounded-lg border border-[#1F2937]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              filter === 'all'
                ? 'bg-[#1F2937] text-white font-bold'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            All ({initialPredictions.length})
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              filter === 'upcoming'
                ? 'bg-[#1F2937] text-amber-300 font-bold'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            Upcoming ({initialPredictions.filter((p) => p.settlement_status === 'PENDING').length})
          </button>
          <button
            onClick={() => setFilter('settled')}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              filter === 'settled'
                ? 'bg-[#1F2937] text-[#10B981] font-bold'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            Settled ({initialPredictions.filter((p) => p.settlement_status === 'SETTLED').length})
          </button>
        </div>

        {/* League Selector */}
        {leagues.length > 1 && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <Filter className="h-3.5 w-3.5 text-[#9CA3AF]" />
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="bg-[#0B0F0E] border border-[#1F2937] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#10B981]"
            >
              <option value="ALL">All Leagues ({initialPredictions.length})</option>
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grid of Predictions */}
      {filtered.length === 0 ? (
        <div className="bg-[#111827]/40 border border-[#1F2937] rounded-xl p-16 text-center text-[#9CA3AF]">
          <Database className="h-10 w-10 mx-auto mb-3 opacity-30 text-amber-400" />
          <h3 className="text-base font-bold text-neutral-200">No predictions found</h3>
          <p className="text-xs text-[#9CA3AF] mt-1 max-w-md mx-auto">
            {filter === 'upcoming'
              ? 'No upcoming fixtures pending prediction in the current cycle.'
              : filter === 'settled'
              ? 'No predictions have settled yet in this environment.'
              : 'Awaiting incoming live data from automated shadow pipeline.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pred) => (
            <PredictionCard key={pred.id} prediction={pred} />
          ))}
        </div>
      )}
    </div>
  );
}
