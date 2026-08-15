'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, MinusCircle, ShieldCheck } from 'lucide-react';
import ExpandableMatchDetail from './ExpandableMatchDetail';

export interface AuditPredictionRow {
  id: string;
  kickoff: string;
  league: string;
  home: string;
  away: string;
  market: string;
  prediction: string;
  probability: number;
  fairOdds: number;
  bookmakerOdds: number;
  ev: number;
  closingOdds?: number;
  clv?: number;
  result?: 'WIN' | 'LOSS' | 'PUSH' | 'PENDING';
  profit?: number;
  confidence?: number;
}

export default function PredictionTable({
  predictions = [],
}: {
  predictions?: AuditPredictionRow[];
  searchParams?: any;
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!predictions || predictions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
        <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          NO VERIFIED PREDICTIONS AVAILABLE
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Prediction ledger is currently tracking verified upcoming matches. Predictions will populate upon model pipeline execution.
        </p>
      </div>
    );
  }

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
            {predictions.map((pred) => (
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
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(pred.kickoff).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                    <div>
                      {pred.home} vs {pred.away}
                    </div>
                    <span className="text-xs text-slate-400">{pred.league}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {pred.prediction}
                    </span>
                    <span className="text-xs text-slate-400 block">{pred.market}</span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {pred.probability.toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {pred.bookmakerOdds.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {pred.ev > 0 ? `+${pred.ev.toFixed(1)}%` : `${pred.ev.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-slate-500">
                    {pred.clv !== undefined ? `${(pred.clv * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {pred.result === 'WIN' && (
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> WIN
                      </span>
                    )}
                    {pred.result === 'LOSS' && (
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> LOSS
                      </span>
                    )}
                    {(!pred.result || pred.result === 'PENDING') && (
                      <span className="inline-flex items-center text-xs font-medium text-slate-500">
                        <MinusCircle className="w-3.5 h-3.5 mr-1" /> PENDING
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-4 text-right font-mono font-semibold ${
                      (pred.profit ?? 0) > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : (pred.profit ?? 0) < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {pred.profit !== undefined
                      ? pred.profit > 0
                        ? `+${pred.profit.toFixed(2)}`
                        : pred.profit.toFixed(2)
                      : '-'}
                  </td>
                </tr>
                {expandedRows[pred.id] && (
                  <tr>
                    <td colSpan={10} className="p-0 border-b border-slate-200 dark:border-slate-800">
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
