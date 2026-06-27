'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SignalBadge } from '../../components/signals/SignalBadge';
import { MarketTag } from '../../components/signals/MarketTag';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';

export default function TrackRecordPage() {
  const [market, setMarket] = useState<'AH' | 'OU' | 'ML' | 'all'>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [signals, setSignals] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecord() {
      try {
        setLoading(true);
        setError(null);
        
        // Query settled status signals
        const marketParam = market === 'all' ? 'AH' : market;
        const res = await fetch(`/api/signals/feed?status=SETTLED&market=${marketParam}`);
        const data = await res.json();
        
        if (data.success) {
          setSignals(data.feed || []);
          setIsPremium(data.is_premium || false);
        } else {
          setError(data.error || 'Failed to fetch track record');
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchRecord();
  }, [market]);

  // Apply in-memory confidence and market filtering
  let filtered = signals;
  if (market !== 'all') {
    filtered = filtered.filter(
      sig => (sig.market_category || '').toLowerCase() === (market === 'AH' ? 'asian_handicap' : market === 'OU' ? 'over_under' : 'moneyline')
    );
  }
  if (confidenceFilter !== 'all') {
    filtered = filtered.filter(
      sig => (sig.confidence_label || '').toLowerCase() === confidenceFilter
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between border-b border-slate-900 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 text-xs font-semibold uppercase tracking-wider text-blue-500">
              <Link href="/signals" className="hover:text-blue-400">Signals Feed</Link>
              <span>/</span>
              <span className="text-slate-400">Track Record</span>
            </div>
            <h1 className="text-4xl font-extrabold text-white">
              Settled Track Record
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              Fully transparent database of resolved predictions. We log every single outcome, odds change, and line shift.
            </p>
          </div>

          {/* Filters */}
          <div className="mt-6 md:mt-0 flex flex-wrap gap-4">
            {/* Market Filter */}
            <div className="flex bg-slate-900 border border-slate-800 rounded p-1">
              {(['all', 'AH', 'OU', 'ML'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                    market === m ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'all' ? 'All Markets' : m === 'AH' ? 'AH' : m === 'OU' ? 'O/U' : 'ML'}
                </button>
              ))}
            </div>

            {/* Confidence Filter */}
            <div className="flex bg-slate-900 border border-slate-800 rounded p-1">
              {(['all', 'high', 'medium', 'low'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setConfidenceFilter(c)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold capitalize transition ${
                    confidenceFilter === c ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Premium Upgrade Banner */}
        {!isPremium && (
          <div className="mb-8 bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-800 rounded-lg p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">
                🔒 Premium Verification Active
              </h3>
              <p className="text-slate-350 text-xs max-w-xl">
                Free tier accounts can only view the last 3 settled predictions. Upgrade to view full historical logs, closing line metrics, and peak equity statistics.
              </p>
            </div>
            <Link
              href="/pricing"
              className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-5 py-2.5 rounded text-xs transition whitespace-nowrap"
            >
              Unlock Track Record
            </Link>
          </div>
        )}

        {/* List Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <span className="text-slate-400">Verifying past settlement results...</span>
          </div>
        ) : error ? (
          <div className="bg-rose-950 border border-rose-900 text-rose-350 p-4 rounded text-center">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-lg text-center text-slate-500">
            No settled track records found matching selected criteria.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold text-xs tracking-wider uppercase">
                    <th className="p-4">Date</th>
                    <th className="p-4">Match</th>
                    <th className="p-4">Market</th>
                    <th className="p-4">Recommended Pick</th>
                    <th className="p-4">Odds</th>
                    <th className="p-4">Closing Odds</th>
                    <th className="p-4">CLV</th>
                    <th className="p-4">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filtered.map((sig) => {
                    const isWin = (sig.status || '').toLowerCase() === 'won' || (sig.status || '').toLowerCase() === 'win' || (sig.status || '').toLowerCase() === 'half_win';
                    const isVoid = (sig.status || '').toLowerCase() === 'void' || (sig.status || '').toLowerCase() === 'push';

                    return (
                      <tr key={sig.id} className="hover:bg-slate-850 transition">
                        <td className="p-4 text-slate-450 font-mono text-xs whitespace-nowrap">
                          {new Date(sig.published_at || sig.kickoff_time).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-bold text-slate-200">
                          {sig.match}
                        </td>
                        <td className="p-4">
                          <MarketTag marketCategory={sig.market_category} />
                        </td>
                        <td className="p-4 font-mono capitalize">
                          {sig.market_selection.replace('_', ' ')}
                        </td>
                        <td className="p-4 font-semibold text-slate-300 font-mono">
                          {Number(sig.odds).toFixed(2)}
                        </td>
                        <td className="p-4 font-mono">
                          {!isPremium ? (
                            <span className="text-slate-500 text-xs">🔒 Locked</span>
                          ) : (
                            <span className="text-slate-300">{Number(sig.current_odds || sig.odds).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="p-4 font-mono">
                          {!isPremium ? (
                            <span className="text-slate-550 text-xs">🔒 Locked</span>
                          ) : (
                            <span className={`font-bold ${sig.clv_percentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {sig.clv_percentage !== undefined ? `${Number(sig.clv_percentage).toFixed(2)}%` : '—'}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                            isWin ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : isVoid ? 'bg-slate-800 text-slate-400' : 'bg-rose-950 text-rose-450 border border-rose-900'
                          }`}>
                            {sig.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
