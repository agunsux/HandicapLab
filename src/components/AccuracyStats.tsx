'use client';

import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, BarChart3, Percent, HelpCircle, Loader2 } from 'lucide-react';
import { mockAccuracyStats } from '@/lib/mockData';

interface AccuracyData {
  total: number;
  accuracy1x2: number;
  accuracyAh: number;
  accuracyOu: number;
}

export function AccuracyStats() {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const res = await fetch('/api/stats/accuracy');
        if (!res.ok) {
          throw new Error('Failed to fetch accuracy stats');
        }
        const json = await res.json();
        
        // If database is empty (total: 0), fallback to sandbox stats so user can see design
        if (json.total === 0) {
          setData(mockAccuracyStats);
          setIsSandbox(true);
        } else {
          setData(json);
          setIsSandbox(false);
        }
      } catch (err: any) {
        console.error('Error fetching stats:', err);
        setError(err.message);
        // Fallback to mock data on network error
        setData(mockAccuracyStats);
        setIsSandbox(true);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 px-4 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl min-h-[220px]">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-3" />
        <p className="text-slate-400 text-sm font-semibold tracking-wide animate-pulse">
          Computing real-time model accuracy metrics...
        </p>
      </div>
    );
  }

  const stats = data || mockAccuracyStats;

  return (
    <div className="w-full rounded-3xl bg-slate-950 p-6 md:p-8 border border-slate-900 shadow-2xl relative overflow-hidden group">
      {/* Background radial gradient */}
      <div className="absolute -right-24 -top-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none transition-all duration-700 group-hover:bg-indigo-500/15" />
      <div className="absolute -left-24 -bottom-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
              AI Prediction Intelligence Ledger
            </h2>
          </div>
          <p className="text-slate-400 text-xs md:text-sm font-medium">
            Quantitative hit rates and performance metrics across major football betting markets.
          </p>
        </div>

        {/* Status Indicator Badge */}
        <div>
          {isSandbox ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-full shadow-inner">
              ⚡ Sandbox/Mock Mode
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-full shadow-inner">
              🟢 Database Connected
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
        {/* Card 1: Evaluated predictions */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all duration-300 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 group/card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-black uppercase tracking-wider">
              Total Evaluated
            </span>
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover/card:bg-indigo-500 group-hover/card:text-white transition-all duration-300">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white tracking-tight mb-1">
              {stats.total}
            </div>
            <p className="text-slate-500 text-[10px] font-medium leading-normal">
              Completed fixtures parsed and settled.
            </p>
          </div>
        </div>

        {/* Card 2: 1X2 accuracy */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all duration-300 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 group/card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-black uppercase tracking-wider">
              Match Winner (1X2)
            </span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover/card:bg-emerald-50 group-hover/card:text-emerald-700 transition-all duration-300">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-black text-white tracking-tight">
                {stats.accuracy1x2}%
              </span>
              <span className="text-emerald-400 text-xs font-bold">Hit Rate</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-1.5 rounded-full" 
                style={{ width: `${stats.accuracy1x2}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Asian Handicap */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all duration-300 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 group/card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-black uppercase tracking-wider">
              Asian Handicap
            </span>
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover/card:bg-indigo-50 group-hover/card:text-indigo-700 transition-all duration-300">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-black text-white tracking-tight">
                {stats.accuracyAh}%
              </span>
              <span className="text-indigo-400 text-xs font-bold">Hit Rate</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-sky-500 h-1.5 rounded-full" 
                style={{ width: `${stats.accuracyAh}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Over/Under */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all duration-300 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 group/card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-xs font-black uppercase tracking-wider">
              Goals Over/Under
            </span>
            <div className="p-2 bg-pink-500/10 rounded-xl text-pink-400 group-hover/card:bg-pink-50 group-hover/card:text-pink-700 transition-all duration-300">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-black text-white tracking-tight">
                {stats.accuracyOu}%
              </span>
              <span className="text-pink-400 text-xs font-bold">Hit Rate</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
              <div 
                className="bg-gradient-to-r from-pink-500 to-rose-500 h-1.5 rounded-full" 
                style={{ width: `${stats.accuracyOu}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
