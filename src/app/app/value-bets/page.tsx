'use client';

import { useEffect, useState } from 'react';
import { EngineStatusWidget } from '@/components/engine/EngineStatusWidget';

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

    // Auto-refresh every 5 minutes per §3
    const interval = setInterval(loadSignals, 300000);
    return () => clearInterval(interval);
  }, []);

  const filteredSignals = signals.filter((s) => {
    if (filterMarket === 'ALL') return true;
    return s.market === filterMarket;
  });

  return (
    <div className="flex flex-col h-full space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold tracking-tight text-foreground">
            Today&apos;s Signals &amp; Value Bets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            High-EV opportunities across Asian Handicap, Over / Under, Moneyline and BTTS.
          </p>
        </div>
        <EngineStatusWidget compact />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {['ALL', 'AH', 'OU', 'ML', 'BTTS'].map((m) => (
          <button
            key={m}
            onClick={() => setFilterMarket(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterMarket === m
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {m === 'ALL' ? 'All Markets' : m}
          </button>
        ))}
      </div>

      {/* Signals Table */}
      {loading ? (
        <div className="rounded-lg border border-border/70 bg-card p-12 text-center text-sm text-muted-foreground animate-pulse">
          Loading live signals...
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="rounded-lg border border-border/70 bg-card/60 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Engine is scanning. No validated opportunities for this window yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
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
            <tbody className="divide-y divide-border/60">
              {filteredSignals.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div>{s.home} vs {s.away}</div>
                    <div className="text-[10px] text-muted-foreground">{s.league} · {new Date(s.kickoff).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.market}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {s.selection} {s.line !== undefined ? `(${s.line > 0 ? `+${s.line}` : s.line})` : ''}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.locked ? <span className="text-amber-500 font-mono">🔒 Locked</span> : `${((s.modelProb || 0) * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.locked ? <span className="text-amber-500 font-mono">🔒 Locked</span> : s.marketOdds?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.locked ? <span className="text-amber-500 font-mono">🔒 Locked</span> : s.fairOdds?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-500">
                    {s.locked ? <span className="text-amber-500 font-mono">🔒 Locked</span> : `+${((s.ev || 0) * 100).toFixed(1)}%`}
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