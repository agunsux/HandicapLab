'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SignalBadge } from '../../../components/signals/SignalBadge';
import { MarketTag } from '../../../components/signals/MarketTag';
import { OddsMovement } from '../../../components/signals/OddsMovement';
import { ConfidenceBadge } from '../../../components/ConfidenceBadge';
import { SignalLifecycle } from '../../../components/signals/SignalLifecycle';

export default function SignalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [signal, setSignal] = useState<any | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`/api/signals/${id}`);
        const data = await res.json();
        
        if (data.success) {
          setSignal(data.data);
          setIsPremium(data.is_premium || false);
        } else {
          setError(data.error || 'Signal not found');
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchDetail();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <span className="text-slate-400">Loading analysis timeline...</span>
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-rose-950 border border-rose-900 text-rose-300 p-6 rounded max-w-md w-full text-center">
          <h3 className="font-bold text-lg mb-2">Error loading signal</h3>
          <p className="text-sm text-rose-450 mb-4">{error || 'Record does not exist.'}</p>
          <Link href="/signals" className="text-sm font-semibold text-blue-400 hover:text-blue-300">
            ← Return to Feed
          </Link>
        </div>
      </div>
    );
  }

  const isPremiumLocked = signal.market_movement.current_odds === null;

  return (
    <div className="min-h-screen bg-black text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="mb-8">
          <Link href="/signals" className="text-slate-400 hover:text-slate-200 text-sm font-semibold flex items-center gap-1.5 transition">
            ← Back to Feed
          </Link>
        </div>

        {/* Hero Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-8 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {signal.match.league || 'International Match'}
            </span>
            <div className="flex items-center gap-2">
              <MarketTag marketCategory={signal.prediction.market} />
              <SignalBadge status={signal.status} />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-2">
            {signal.match.home_team} vs {signal.match.away_team}
          </h1>
          <p className="text-slate-450 text-xs font-mono">
            KICKOFF (UTC): {new Date(signal.match.kickoff_time).toUTCString()}
          </p>
        </div>

        {/* Lifecycle Visual Timeline */}
        <div className="mb-8">
          <SignalLifecycle auditEvents={signal.audit_events} status={signal.status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Prediction & Model Info */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Pick Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                Recommended Bet Selection
              </h3>
              <div className="bg-slate-950 border border-slate-850 rounded p-4 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-xs block mb-1">MARKET SELECTION</span>
                  <span className="text-xl font-bold text-white capitalize">
                    {signal.prediction.selection.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-xs block mb-1">MODEL ADVANTAGE</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {signal.prediction.edge !== null ? `+${signal.prediction.edge.toFixed(1)}%` : '🔒 Premium'}
                  </span>
                </div>
              </div>
            </div>

            {/* Market History & Odds Movement */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                Market Movements & Price Shifts
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-850">
                  <span className="text-slate-400 text-sm">Opening Odds</span>
                  <span className="font-semibold font-mono text-slate-200">
                    {signal.prediction.odds.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-slate-850">
                  <span className="text-slate-400 text-sm">Closing / Current Odds</span>
                  {isPremiumLocked ? (
                    <span className="text-amber-500 text-sm font-semibold">🔒 Unlock Premium</span>
                  ) : (
                    <OddsMovement openingOdds={signal.prediction.odds} currentOdds={signal.market_movement.current_odds} />
                  )}
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400 text-sm">Closing Line Value (CLV)</span>
                  {isPremiumLocked ? (
                    <span className="text-slate-500 text-sm italic">Locked</span>
                  ) : (
                    <span className={`font-bold font-mono text-sm ${Number(signal.market_movement.clv || 0) >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                      {signal.market_movement.clv !== null ? `${signal.market_movement.clv.toFixed(2)}%` : '—'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Model & Timelines */}
          <div className="space-y-6">
            {/* Model Confidence */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                Model Validation
              </h3>
              <div className="space-y-4">
                <div>
                  <span className="text-slate-500 text-xs block mb-1">CONFIDENCE WEIGHT</span>
                  <ConfidenceBadge confidence={signal.prediction.confidence} />
                </div>
                <div>
                  <span className="text-slate-500 text-xs block mb-1">ENGINE VERSION</span>
                  <span className="font-semibold text-slate-200 text-sm">{signal.prediction.model_version}</span>
                </div>
                {signal.metrics && (
                  <div>
                    <span className="text-slate-500 text-xs block mb-1">QUALITY INTEGRITY SCORE</span>
                    <span className="font-bold font-mono text-emerald-400 text-base">
                      {signal.metrics.quality_score} / 100
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Timeline */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                Audit Timeline
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block">CREATED</span>
                  <span className="text-slate-300">{new Date(signal.timeline.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">PUBLISHED</span>
                  <span className="text-slate-300">{new Date(signal.timeline.published_at).toLocaleString()}</span>
                </div>
                {signal.timeline.locked_at && (
                  <div>
                    <span className="text-slate-500 block">LOCKED</span>
                    <span className="text-slate-300">{new Date(signal.timeline.locked_at).toLocaleString()}</span>
                  </div>
                )}
                {signal.timeline.settled_at && (
                  <div>
                    <span className="text-slate-500 block">SETTLED</span>
                    <span className="text-slate-300">{new Date(signal.timeline.settled_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
