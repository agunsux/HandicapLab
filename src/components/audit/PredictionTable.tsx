'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import ExpandableMatchDetail from './ExpandableMatchDetail';

// Mock data for initial UI
const mockPredictions = [
  {
    id: 'pred-001',
    kickoff: '2026-07-28T14:00:00Z',
    league: 'Premier League',
    home: 'Arsenal',
    away: 'Brighton',
    market: 'Moneyline',
    prediction: 'Arsenal',
    probability: 63,
    fairOdds: 1.59,
    bookmakerOdds: 1.92,
    ev: 17,
    closingOdds: 1.83,
    clv: 0.09,
    result: 'WIN',
    profit: 0.92,
    confidence: 81
  },
  {
    id: 'pred-002',
    kickoff: '2026-07-28T16:30:00Z',
    league: 'Serie A',
    home: 'Juventus',
    away: 'Napoli',
    market: 'Over 2.5',
    prediction: 'Over 2.5',
    probability: 52,
    fairOdds: 1.92,
    bookmakerOdds: 2.10,
    ev: 9.2,
    closingOdds: 2.05,
    clv: 0.05,
    result: 'LOSS',
    profit: -1.0,
    confidence: 65
  }
];

export default function PredictionTable({ searchParams }: { searchParams: any }) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium"></th>
              <th className="px-4 py-3 font-medium">Kickoff</th>
              <th className="px-4 py-3 font-medium">Match</th>
              <th className="px-4 py-3 font-medium">Market / Pred</th>
              <th className="px-4 py-3 font-medium text-right">Prob %</th>
              <th className="px-4 py-3 font-medium text-right">Odds</th>
              <th className="px-4 py-3 font-medium text-right">EV %</th>
              <th className="px-4 py-3 font-medium text-right">CLV</th>
              <th className="px-4 py-3 font-medium text-center">Result</th>
              <th className="px-4 py-3 font-medium text-right">P/L (U)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {mockPredictions.map((pred) => (
              <React.Fragment key={pred.id}>
                <tr 
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => toggleRow(pred.id)}
                >
                  <td className="px-4 py-4 w-10">
                    {expandedRows[pred.id] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {new Date(pred.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <div className="text-xs text-slate-400">{new Date(pred.kickoff).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{pred.home} vs {pred.away}</div>
                    <div className="text-xs text-slate-500">{pred.league}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{pred.prediction}</div>
                    <div className="text-xs text-slate-500">{pred.market}</div>
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-slate-900 dark:text-white">
                    {pred.probability}%
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="text-slate-900 dark:text-white">{pred.bookmakerOdds.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">Fair: {pred.fairOdds.toFixed(2)}</div>
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                    +{pred.ev}%
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-blue-600 dark:text-blue-400">
                    +{pred.clv.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {pred.result === 'WIN' && <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />}
                    {pred.result === 'LOSS' && <XCircle className="w-5 h-5 text-rose-500 mx-auto" />}
                    {pred.result === 'PUSH' && <MinusCircle className="w-5 h-5 text-slate-400 mx-auto" />}
                  </td>
                  <td className={`px-4 py-4 text-right font-bold ${
                    pred.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {pred.profit > 0 ? '+' : ''}{pred.profit.toFixed(2)}
                  </td>
                </tr>
                {expandedRows[pred.id] && (
                  <tr>
                    <td colSpan={10} className="px-0 py-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      <ExpandableMatchDetail predictionId={pred.id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
