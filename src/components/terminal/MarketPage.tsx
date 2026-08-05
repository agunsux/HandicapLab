'use client';

import { useEffect, useState } from 'react';
import { EngineStatusWidget } from '@/components/engine/EngineStatusWidget';
import { EVBadge } from '@/components/ui/EVBadge';

type MarketCategory = 'asian-handicap' | 'over-under' | 'moneyline' | 'btts';

const MARKET_TITLE_MAP: Record<MarketCategory, string> = {
  'asian-handicap': 'Asian Handicap',
  'over-under': 'Over / Under',
  'moneyline': 'Moneyline',
  'btts': 'Both Teams to Score (BTTS)',
};

interface MarketPageProps {
  market: MarketCategory;
  description: string;
}

interface MarketRow {
  id: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  market: string;
  selection: string;
  line?: number;
  modelProb?: number;
  marketOdds?: number;
  fairOdds?: number;
  ev?: number;
  locked: boolean;
}

export function MarketPage({ market, description }: MarketPageProps) {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMarketData() {
      try {
        const res = await fetch(`/api/v1/markets/${market}`);
        const json = await res.json();
        if (json.success) {
          setRows(json.data || []);
        }
      } catch (err) {
        console.error(`Failed to fetch ${market} market data:`, err);
      } finally {
        setLoading(false);
      }
    }
    loadMarketData();

    const interval = setInterval(loadMarketData, 300000);
    return () => clearInterval(interval);
  }, [market]);

  const hasLineColumn = market === 'asian-handicap' || market === 'over-under';

  return (
    <div className="flex flex-col h-full space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold tracking-tight text-[#F0F1F5]">
            {MARKET_TITLE_MAP[market]}
          </h1>
          <p className="mt-1 text-sm text-[#8B92A8]">{description}</p>
        </div>
        <EngineStatusWidget compact />
      </div>

      {/* Table / Empty State */}
      {loading ? (
        <div className="rounded-xl border border-[#1F232C] bg-[#111318] p-12 text-center text-sm text-[#8B92A8] animate-pulse">
          Loading {MARKET_TITLE_MAP[market]} market data...
        </div>
      ) : rows.length === 0 ? (
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
                <th className="px-4 py-3">Selection</th>
                {hasLineColumn && <th className="px-4 py-3">Line</th>}
                <th className="px-4 py-3 text-right">Model Prob</th>
                <th className="px-4 py-3 text-right">Market Odds</th>
                <th className="px-4 py-3 text-right">Fair Odds</th>
                <th className="px-4 py-3 text-right">Expected Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F232C]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#1A1D24]/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#F0F1F5]">
                    <div>{r.home} vs {r.away}</div>
                    <div className="text-[10px] text-[#5A6070]">{r.league} · {new Date(r.kickoff).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#F0F1F5] capitalize">{r.selection}</td>
                  {hasLineColumn && (
                    <td className="px-4 py-3 tabular-nums text-[#8B92A8]">
                      {r.line !== undefined ? (r.line > 0 ? `+${r.line}` : r.line) : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.locked ? <span className="text-amber-400 font-mono">🔒 Locked</span> : `${((r.modelProb || 0) * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.locked ? <span className="text-amber-400 font-mono">🔒 Locked</span> : r.marketOdds?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.locked ? <span className="text-amber-400 font-mono">🔒 Locked</span> : r.fairOdds?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EVBadge ev={r.ev} locked={r.locked} />
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