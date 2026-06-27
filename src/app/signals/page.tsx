'use client';

import React, { useState, useEffect } from 'react';
import { SignalCard } from '../../components/signals/SignalCard';
import Link from 'next/link';

export default function SignalsFeedPage() {
  const [market, setMarket] = useState<'AH' | 'OU' | 'ML'>('AH');
  const [signals, setSignals] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeed() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch from Feed API (supports ?market= filter)
        const res = await fetch(`/api/signals/feed?market=${market}`);
        const data = await res.json();
        
        if (data.success) {
          setSignals(data.feed || []);
          setIsPremium(data.is_premium || false);
        } else {
          setError(data.error || 'Failed to fetch feed');
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchFeed();
  }, [market]);

  return (
    <div className="min-h-screen bg-black text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="mb-10 text-center md:text-left md:flex md:items-end md:justify-between border-b border-slate-900 pb-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              HandicapLab Signals
            </h1>
            <p className="mt-3 text-lg text-slate-400 max-w-2xl">
              Live quantitative predictions powered by high-caliber ELO pricing, current-to-closing line movements, and value edge metrics.
            </p>
          </div>
          
          <div className="mt-6 md:mt-0 flex gap-3 justify-center">
            {['AH', 'OU', 'ML'].map((m) => (
              <button
                key={m}
                onClick={() => setMarket(m as any)}
                className={`px-5 py-2.5 rounded font-semibold text-sm border transition-all ${
                  market === m
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'AH' && 'Asian Handicap'}
                {m === 'OU' && 'Over / Under'}
                {m === 'ML' && 'Moneyline'}
              </button>
            ))}
          </div>
        </header>

        {/* Premium Banner Upsell */}
        {!isPremium && (
          <div className="mb-10 bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-800 rounded-lg p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                🔒 Unlock Premium Analytical Depth
              </h3>
              <p className="text-slate-350 text-sm max-w-xl">
                Free users are restricted to 3 active signals and hidden edge percentages. Upgrade to Pro/Quant tier to reveal real-time closing price history, CLV ratios, and full history.
              </p>
            </div>
            <Link
              href="/pricing"
              className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-6 py-3 rounded text-sm transition shadow-md whitespace-nowrap"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        {/* Feed State Handler */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <span className="text-slate-400">Loading intelligence data...</span>
          </div>
        ) : error ? (
          <div className="bg-rose-950 border border-rose-900 text-rose-300 p-4 rounded text-center">
            {error}
          </div>
        ) : signals.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-lg text-center text-slate-450">
            No active signals available for the selected market category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {signals.map((sig) => (
              <SignalCard key={sig.id} signal={sig} />
            ))}
          </div>
        )}
        
      </div>
    </div>
  );
}
