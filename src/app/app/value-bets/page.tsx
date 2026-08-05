'use client';

import React, { useState } from 'react';
import { Target, Zap, Clock, Users, ArrowUpRight, X, Shield, Plus, Check } from 'lucide-react';
import { useSignals } from '@/hooks/useApi';
import { useAppStore } from '@/store/appStore';
import { EVBadge } from '@/components/ui/EVBadge';
import { Signal } from '@/types';

const CATEGORIES = ['All', 'Value', 'Steam', 'Drift', 'Sharp', 'Reverse Line'];

export default function ValueBetsPage() {
  const { userTier, autoRefresh } = useAppStore();
  const { data: signals, isLoading } = useSignals();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const [addedToSlip, setAddedToSlip] = useState<Record<string, boolean>>({});

  const filteredSignals = (signals || []).filter((sig: Signal) => {
    if (selectedCategory === 'All') return true;
    return sig.signalCategory === selectedCategory || sig.type === selectedCategory.toLowerCase();
  });

  const handleAddToSlip = (sig: Signal) => {
    setAddedToSlip((prev) => ({ ...prev, [sig.id]: true }));
    setTimeout(() => {
      setAddedToSlip((prev) => ({ ...prev, [sig.id]: false }));
    }, 2500);
  };

  return (
    <div className="flex flex-col space-y-6 pb-8">
      {/* Header with Auto-Refresh 10s Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold tracking-tight text-[#F0FDF4]">
              Value Signals
            </h1>
            {autoRefresh && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-ping" />
                Live 10s Polling
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Real-time quantitative edge detection and sharp money flow signals.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[#1F2937]">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#10B981] text-black font-bold shadow-sm'
                  : 'bg-[#111827] text-[#9CA3AF] border border-[#1F2937] hover:text-[#F0FDF4] hover:border-[#10B981]/50'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Signal Cards List */}
      {isLoading ? (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-12 text-center text-sm text-[#9CA3AF] animate-pulse">
          Scanning engine for live high-EV value bets...
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-12 text-center text-sm text-[#9CA3AF]">
          No active signals found for category "{selectedCategory}".
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSignals.map((sig) => {
            const isLocked = userTier === 'free' && sig.confidence > 75;
            const isHighValue = sig.ev > 8.0 || sig.isHighValue;

            return (
              <div
                key={sig.id}
                onClick={() => !isLocked && setActiveSignal(sig)}
                className={`relative rounded-xl border border-[#1F2937] bg-[#111827] p-6 shadow-sm hover:border-[#10B981]/50 transition-all cursor-pointer overflow-hidden ${
                  isLocked ? 'cursor-not-allowed' : ''
                }`}
              >
                {/* TOP RIGHT HIGH VALUE BADGE */}
                {isHighValue && !isLocked && (
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-bold uppercase tracking-wider">
                    <Zap className="h-3.5 w-3.5" /> HIGH VALUE
                  </div>
                )}

                {/* Main Card Content */}
                <div className={`space-y-4 ${isLocked ? 'filter blur-[5px] opacity-30 select-none pointer-events-none' : ''}`}>
                  {/* Category Badge & Teams */}
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-bold">
                      {sig.signalCategory || sig.marketType}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">{sig.league}</span>
                  </div>

                  {/* Selection Name & Bookmaker */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-bold text-[#F0FDF4]">
                        {sig.selection}
                      </h3>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        {sig.homeTeam} vs {sig.awayTeam} · <span className="text-[#F0FDF4] font-semibold">{sig.bookmaker}</span>
                      </p>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <div className="text-right">
                        <span className="text-2xl font-mono font-bold text-[#F0FDF4]">{sig.odds.toFixed(2)}</span>
                        <span className="text-xs text-[#9CA3AF] ml-2">Fair: {sig.fairOdds.toFixed(2)}</span>
                      </div>
                      <EVBadge evPercent={sig.ev} size="lg" />
                    </div>
                  </div>

                  {/* Reason Text */}
                  <p className="text-xs text-[#9CA3AF] leading-relaxed bg-[#0B0F0E] p-3 rounded-lg border border-[#1F2937]/50">
                    {sig.reason}
                  </p>

                  {/* Meta Bar: Expiry & Public Money */}
                  <div className="flex items-center gap-6 text-xs text-[#9CA3AF]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#10B981]" />
                      <span>Expires in {sig.expiryTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#F59E0B]" />
                      <span>Public Money: {sig.publicMoneyPercent}%</span>
                    </div>
                  </div>

                  {/* Tony Bloom Metrics Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1F2937]">
                    {/* Sharp Money Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#9CA3AF] mb-1">
                        <span>Sharp Money Index</span>
                        <span className="text-[#10B981] font-mono">{sig.sharpMoney}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#0B0F0E] overflow-hidden border border-[#1F2937]">
                        <div
                          className="h-full bg-[#10B981] rounded-full transition-all"
                          style={{ width: `${sig.sharpMoney}%` }}
                        />
                      </div>
                    </div>

                    {/* Model Confidence Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#9CA3AF] mb-1">
                        <span>Model Confidence Score</span>
                        <span className="text-[#10B981] font-mono">{sig.confidence}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#0B0F0E] overflow-hidden border border-[#1F2937]">
                        <div
                          className="h-full bg-[#10B981] rounded-full transition-all"
                          style={{ width: `${sig.confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Free Tier Premium Lock Overlay */}
                {isLocked && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#0B0F0E]/80 backdrop-blur-md text-center">
                    <div className="h-10 w-10 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] mb-3">
                      <Shield className="h-5 w-5" />
                    </div>
                    <h4 className="text-base font-bold text-[#F0FDF4] mb-1">
                      High Confidence Signal Locked ({sig.confidence}% Confidence)
                    </h4>
                    <p className="text-xs text-[#9CA3AF] max-w-sm mb-4">
                      Upgrade to PRO plan to view high-value signals, sharp money index breakdown, and model fair odds.
                    </p>
                    <a
                      href="/pricing"
                      className="px-5 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-bold text-xs transition-colors shadow-md"
                    >
                      Upgrade to PRO Plan
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Signal Detail Modal */}
      {activeSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#111827] border border-[#1F2937] rounded-2xl p-6 shadow-2xl space-y-6">
            {/* Close Button */}
            <button
              onClick={() => setActiveSignal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#0B0F0E] border border-[#1F2937] text-[#9CA3AF] hover:text-[#F0FDF4]"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-bold mb-2">
                {activeSignal.signalCategory || activeSignal.marketType} Signal
              </div>
              <h2 className="text-2xl font-bold text-[#F0FDF4]">
                {activeSignal.selection}
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-1">
                {activeSignal.homeTeam} vs {activeSignal.awayTeam} · {activeSignal.league}
              </p>
            </div>

            {/* Odds Comparison Grid */}
            <div className="grid grid-cols-3 gap-4 bg-[#0B0F0E] border border-[#1F2937] rounded-xl p-4 text-center font-mono">
              <div>
                <div className="text-[11px] font-sans text-[#9CA3AF]">Current Odds</div>
                <div className="text-xl font-bold text-[#F0FDF4] mt-1">{activeSignal.odds.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[11px] font-sans text-[#9CA3AF]">Model Fair Odds</div>
                <div className="text-xl font-bold text-[#10B981] mt-1">{activeSignal.fairOdds.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[11px] font-sans text-[#9CA3AF]">Expected Value</div>
                <div className="text-xl font-bold text-[#10B981] mt-1">+{activeSignal.ev.toFixed(1)}%</div>
              </div>
            </div>

            {/* Edge Analysis Section */}
            <div>
              <h3 className="text-sm font-semibold text-[#F0FDF4] mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-[#10B981]" /> Quantitative Rationale
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed bg-[#0B0F0E] p-4 rounded-xl border border-[#1F2937]">
                {activeSignal.reason}
              </p>
            </div>

            {/* Line Movement Section */}
            <div className="flex items-center justify-between bg-[#0B0F0E] p-4 rounded-xl border border-[#1F2937] text-xs">
              <div>
                <span className="font-semibold text-[#F0FDF4]">Line Movement Trend:</span>
                <span className="ml-2 text-[#10B981] font-bold">Steam Up (+3.7% Inflow)</span>
              </div>
              <span className="text-[#9CA3AF]">Bookmaker: {activeSignal.bookmaker}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveSignal(null)}
                className="px-4 py-2.5 rounded-lg border border-[#1F2937] text-xs text-[#9CA3AF] hover:text-[#F0FDF4]"
              >
                Close
              </button>
              <button
                onClick={() => handleAddToSlip(activeSignal)}
                className="px-6 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-bold text-xs transition-colors flex items-center gap-2 shadow-md"
              >
                {addedToSlip[activeSignal.id] ? (
                  <>
                    <Check className="h-4 w-4" /> Added to Bet Slip
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add to Bet Slip
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}