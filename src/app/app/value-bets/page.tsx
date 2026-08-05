'use client';

import { useEffect, useState } from 'react';
import { EngineStatusWidget } from '@/components/engine/EngineStatusWidget';
import { EVBadge } from '@/components/ui/EVBadge';
import { FilterChip } from '@/components/ui/FilterChip';

interface SignalOpportunity {
  id: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  market: string;
  selection?: string;
  line?: number;
  modelProb?: number;
  marketOdds?: number;
  fairOdds?: number;
  ev?: number;
  locked: boolean;
}

export default function ValueBetsPage() {
  const [signals, setSignals] = useState<SignalOpportunity[]>([]);
  const [filterMarket, setFilterMarket] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSignals() {
      try {
        const res = await fetch('/api/v1/signals');
        const json = await res.json();
        if (json.success) {
          setSignals(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch signals:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSignals();

    const interval = setInterval(loadSignals, 300000);
    return () => clearInterval(interval);
  }, []);

  const filteredSignals = signals.filter((s) => {
    if (filterMarket === 'ALL') return true;
    return s.market === filterMarket;
  });

  const getMarketCount = (m: string) => {
    if (m === 'ALL') return signals.length;
    return signals.filter((s) => s.market === m).length;
  };

  return (
    <div className="flex flex-col h-full space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold tracking-tight text-[#F0F1F5]">
            Today&apos;s Signals &amp; Value Bets
          </h1>
          <p className="mt-1 text-sm text-[#8B92A8]">
            High-EV opportunities across Asian Handicap, Over / Under, Moneyline and BTTS.
          </p>
        </div>
        <EngineStatusWidget compact />
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 border-b border-[#1F232C] pb-3 overflow-x-auto">
        {['ALL', 'AH', 'OU', 'ML', 'BTTS'].map((m) => (
          <FilterChip
            key={m}
            label={m === 'ALL' ? 'All Markets' : m}
            count={getMarketCount(m)}
            active={filterMarket === m}
            onClick={() => setFilterMarket(m)}
          />
        ))}
      </div>

      {/* Signals Table */}
      {loading ? (
        <div className="rounded-xl border border-[#1F232C] bg-[#111318] p-12 text-center text-sm text-[#8B92A8] animate-pulse">
          Loading live signals...
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="rounded-xl border border-[#1F232C] bg-[#111318]/60 p-12 text-center">
          <p className="text-sm text-[#8B92A8]">
            Engine is scanning. No validated opportunities for this window yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1F232C] bg-[#111318] shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1F232C] bg-[#1A1D24] text-[11px] uppercase tracking-wider text-[#8B92A8]">
              <tr>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Selection</th>
                <th className="px-4 py-3 text-right">Model Prob</th>
                <th className="px-4 py-3 text-right">Market Odds</th>
                <th className="px-4 py-3 text-right">Fair Odds</th>
                <th className="px-4 py-3 text-right">Expected Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F232C]">
              {filteredSignals.map((s) => (
                <tr key={s.id} className="hover:bg-[#1A1D24]/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#F0F1F5]">
                    <div>{s.home} vs {s.away}</div>
                    <div className="text-[10px] text-[#5A6070]">{s.league} · {new Date(s.kickoff).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 text-[#8B92A8]">{s.market}</td>
                  <td className="px-4 py-3 font-medium text-[#F0F1F5]">
                    {s.selection} {s.line !== undefined ? `(${s.line > 0 ? `+${s.line}` : s.line})` : ''}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.locked ? <span className="text-amber-400 font-mono">🔒 Locked</span> : `${((s.modelProb || 0) * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.locked ? <span className="text-amber-400 font-mono">🔒 Locked</span> : s.marketOdds?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.locked ? <span className="text-amber-400 font-mono">🔒 Locked</span> : s.fairOdds?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EVBadge ev={s.ev} locked={s.locked} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}