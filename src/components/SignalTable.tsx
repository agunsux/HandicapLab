'use client';

import { useState, useEffect } from 'react';

type Signal = {
  id: string;
  match: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    startTime: string;
  };
  market: string;
  selection: string;
  odds: number;
  expectedValue: number;
  confidence: number;
  status: string;
  createdAt: string;
};

export default function SignalTable() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await fetch('/api/signals');
        if (response.ok) {
          const data = await response.json();
          setSignals(data);
        }
      } catch (error) {
        console.error('Failed to fetch signals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSignals();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl bg-slate-900 shadow-xl border border-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
            <tr>
              <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Match</th>
              <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Market</th>
              <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Selection</th>
              <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Odds</th>
              <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">EV</th>
              <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Conf.</th>
              <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {signals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  No signals found.
                </td>
              </tr>
            ) : (
              signals.map((signal) => (
                <tr key={signal.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    <div className="flex flex-col">
                      <span>{signal.match.homeTeam} vs {signal.match.awayTeam}</span>
                      <span className="text-xs text-slate-500 mt-1">{signal.match.league} • {new Date(signal.match.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {signal.market}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-emerald-400 font-medium">
                    {signal.selection}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-300">
                    {signal.odds.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    <span className={signal.expectedValue > 0 ? "text-emerald-400" : "text-rose-400"}>
                      {signal.expectedValue > 0 ? "+" : ""}{signal.expectedValue.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-mono text-slate-300">{(signal.confidence * 100).toFixed(0)}%</span>
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${signal.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      signal.status === 'OPEN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                      signal.status === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      signal.status === 'LOSS' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {signal.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
