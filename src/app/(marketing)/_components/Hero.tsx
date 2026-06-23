'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Hero() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
      {/* Background Radial Glow */}
      <div className="absolute top-[-10%] left-[50%] h-[600px] w-[800px] -translate-x-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-teal-500/5 blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6 relative z-10 flex flex-col items-center text-center">
        {/* Upper Pill Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-400 font-mono"
        >
          <Sparkles className="h-3 w-3" />
          CALIBRATED ENSEMBLE SYSTEM 1.2
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-zinc-100 sm:text-5xl md:text-6xl"
        >
          Quant-Grade Football Analytics.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            Built for the 1%.
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg"
        >
          Calibrate your sports investment strategy with ensembled double-Poisson and Dixon-Coles goal matrices. Live backtested outputs updated in real-time. No sentiment. Just pure mathematical edge.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <button
            onClick={() => scrollToSection('waitlist')}
            className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3.5 text-sm font-bold text-[#09090B] transition-all hover:opacity-95 shadow-[0_0_20px_rgba(52,211,153,0.15)]"
          >
            Secure Early Access
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-zinc-100 transition-colors flex items-center gap-2"
          >
            Explore Live Ledger
          </a>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-zinc-500 font-mono"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400/80" /> Zero Look-ahead Leakage
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400/80" /> Real-time Pinnacle Odds Calibration
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400/80" /> Brier Score Verified &lt; 0.22
          </div>
        </motion.div>

        {/* Dashboard Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 w-full max-w-5xl rounded-xl border border-white/[0.05] bg-[#121215]/60 p-2 md:p-3 backdrop-blur-sm"
        >
          <div className="rounded-lg border border-white/[0.03] bg-[#09090B] overflow-hidden shadow-2xl">
            {/* Mock Dashboard Header */}
            <div className="flex h-11 items-center justify-between border-b border-white/[0.05] bg-[#121215]/50 px-4">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-500/40" />
                <span className="h-3 w-3 rounded-full bg-amber-500/40" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/40" />
                <span className="ml-2 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">SHINERVA.ID // CORE ENGINE</span>
              </div>
              <div className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-mono text-[9px] text-emerald-400 animate-pulse">
                ● LIVE CALIBRATION FEED
              </div>
            </div>

            {/* Mock Dashboard Body */}
            <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
              {/* Left Side: stats */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-lg border border-white/[0.04] bg-[#121215]/80 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-500 uppercase">Equity curve (60D backtest)</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">+14.7% ROI</span>
                  </div>
                  <div className="h-36 w-full mt-3 flex items-end">
                    <svg viewBox="0 0 500 100" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0 80 Q 50 60 100 70 T 200 40 T 300 50 T 400 20 T 500 10"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                      />
                      <path
                        d="M 0 80 Q 50 60 100 70 T 200 40 T 300 50 T 400 20 T 500 10 L 500 100 L 0 100 Z"
                        fill="url(#glow)"
                      />
                    </svg>
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.04] bg-[#121215]/80 p-4">
                  <span className="font-mono text-xs text-zinc-500 uppercase block mb-3">Live Active Signals</span>
                  <div className="space-y-2.5">
                    {[
                      { match: 'Arsenal vs Man City', market: 'AH -0.5', odds: 1.95, edge: '+6.8%', prob: '54.7%', tier: 'ELITE' },
                      { match: 'Real Madrid vs Barcelona', market: 'OU Over 2.5', odds: 1.82, edge: '+5.2%', prob: '57.8%', tier: 'PRO' }
                    ].map((signal, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded bg-[#09090B] border border-white/[0.03] text-xs font-mono">
                        <div>
                          <span className="text-zinc-300 font-semibold">{signal.match}</span>
                          <span className="text-zinc-500 text-[10px] block mt-0.5">{signal.market} @ {signal.odds}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-emerald-400 font-bold block">{signal.edge} Edge</span>
                            <span className="text-[10px] text-zinc-500 block">Prob {signal.prob}</span>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">
                            {signal.tier}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side: parameters */}
              <div className="rounded-lg border border-white/[0.04] bg-[#121215]/80 p-4 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-xs text-zinc-500 uppercase block">Model Calibration Metrics</span>
                  <div className="mt-4 space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Brier Score</span>
                      <span className="text-zinc-200">0.1824</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1">
                      <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '84%' }}></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Reliability Index</span>
                      <span className="text-zinc-200">0.962</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1">
                      <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '96%' }}></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">ECE Calibration</span>
                      <span className="text-zinc-200">2.14%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1">
                      <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.05] font-mono text-[10px] text-zinc-500 leading-relaxed">
                  // Staking sizing automatically calculated using fractional Kelly criterion (0.25 scaling factor) clamped to 10% max bankroll allocations.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
