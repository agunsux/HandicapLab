'use client';

import { useState } from 'react';

interface LedgerItem {
  id: string;
  published_at: string;
  market: string;
  selection: string | null;
  odds_at_prediction: number | null;
  confidence: number | null;
  model_version: string;
  result_status: string;
  settled_at: string | null;
  roi: number | null;
  verified: boolean;
  home_team: string;
  away_team: string;
  kickoff: string;
  competition_name: string;
  competition_logo: string;
}

interface LedgerTableProps {
  initialItems: LedgerItem[];
}

export function LedgerTable({ initialItems }: LedgerTableProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  const filteredItems = initialItems.filter((item) => {
    if (filter === 'all') return true;
    return item.result_status.toLowerCase() === filter;
  });

  // Calculate stats based on ledger items
  const settled = initialItems.filter(item => item.result_status !== 'pending' && item.result_status !== 'void');
  const wins = settled.filter(item => item.result_status === 'won');
  const winRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0;
  
  // Total ROI yields
  const totalRoi = settled.reduce((sum, item) => sum + (item.roi || 0), 0);
  
  const avgConfidence = initialItems.length > 0
    ? initialItems.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / initialItems.length
    : 0;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'won': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'lost': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'void': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  const getMarketLabel = (mkt: string) => {
    switch (mkt) {
      case 'asian_handicap': return 'Asian Handicap';
      case 'over_under': return 'Over / Under';
      case 'moneyline': return 'Moneyline';
      default: return mkt;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Mini Stats Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Total Ledger Picks</span>
          <span className="text-2xl font-mono font-bold text-white mt-1">{initialItems.length}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Average Confidence</span>
          <span className="text-2xl font-mono font-bold text-teal-400 mt-1">{avgConfidence.toFixed(1)}%</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Net ROI Yield</span>
          <span className={`text-2xl font-mono font-bold mt-1 ${totalRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalRoi >= 0 ? '+' : ''}{totalRoi.toFixed(2)}%
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Win Rate (Settle)</span>
          <span className="text-2xl font-mono font-bold text-white mt-1">
            {settled.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
          </span>
        </div>
      </div>

      {/* Interactive Tabs Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'pending', 'won', 'lost'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded text-xs font-mono font-bold transition-all uppercase ${
                filter === tab
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:text-slate-200'
              }`}
            >
              {tab} ({tab === 'all' ? initialItems.length : initialItems.filter(i => i.result_status.toLowerCase() === tab).length})
            </button>
          ))}
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          Filter: active on client side
        </span>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-6 py-4">Match</th>
                <th className="px-6 py-4">Competition</th>
                <th className="px-6 py-4">Prediction Time</th>
                <th className="px-6 py-4">Market / Pick</th>
                <th className="px-6 py-4 text-center">Odds</th>
                <th className="px-6 py-4 text-center">Confidence</th>
                <th className="px-6 py-4 text-right">Result / Yield</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredItems.map((item) => {
                const isPending = item.result_status === 'pending';
                const datePublished = new Date(item.published_at);
                
                return (
                  <tr key={item.id} className="hover:bg-slate-850/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-sans font-bold text-white text-sm">
                        {item.home_team} vs {item.away_team}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Kickoff: {new Date(item.kickoff).toLocaleDateString()} {new Date(item.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {item.competition_logo && (
                          <img src={item.competition_logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                        )}
                        <span className="font-medium text-slate-200">{item.competition_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {datePublished.toLocaleDateString()} {datePublished.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-teal-400 font-bold">{getMarketLabel(item.market)}</div>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5">Selection: {item.selection || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-200 font-bold">
                      {item.odds_at_prediction ? `${item.odds_at_prediction.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center text-teal-400 font-bold">
                      {item.confidence ? `${item.confidence}%` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${getStatusColor(item.result_status)}`}>
                          {item.result_status}
                        </span>
                        {!isPending && item.roi !== null && (
                          <span className={`text-[11px] font-bold ${item.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.roi >= 0 ? '+' : ''}{item.roi.toFixed(1)}% ROI
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-mono">
                    No predictions found matching the active filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
