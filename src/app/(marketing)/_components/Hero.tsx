'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldCheck, Database, Award, LineChart } from 'lucide-react';
import Link from 'next/link';

export default function Hero() {
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
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 font-mono tracking-wide"
        >
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          QUANTITATIVE SPORTS INTELLIGENCE PLATFORM
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-5xl text-4xl font-extrabold tracking-tight text-zinc-100 sm:text-5xl md:text-6xl leading-[1.15]"
        >
          Scientific modeling for{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            football market inefficiencies.
          </span>
        </motion.h1>

        {/* Manifesto 4 Principles Mantra */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-3xl rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 sm:p-5 text-xs sm:text-sm text-zinc-300 font-mono leading-relaxed shadow-inner"
        >
          <p className="text-emerald-400 font-bold mb-1 tracking-wider uppercase text-[11px]">The HandicapLab Invariant:</p>
          <span className="text-zinc-200 font-semibold">Every prediction is permanent.</span>{" "}
          <span className="text-zinc-300">Every result is auditable.</span>{" "}
          <span className="text-zinc-300">Every model improvement is measurable.</span>{" "}
          <span className="text-emerald-400 font-medium">Every published claim is independently verifiable.</span>
        </motion.div>

        {/* Four Pillars Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl w-full"
        >
          <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-800/60 bg-[#0c0d12] text-center">
            <LineChart className="h-4 w-4 text-emerald-400 mb-1.5" />
            <span className="text-xs font-bold text-zinc-200 font-mono">Scientific Models</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">Double Poisson & Dixon-Coles</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-800/60 bg-[#0c0d12] text-center">
            <ShieldCheck className="h-4 w-4 text-teal-400 mb-1.5" />
            <span className="text-xs font-bold text-zinc-200 font-mono">Scientific Validation</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">Brier & ECE Calibration</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-800/60 bg-[#0c0d12] text-center">
            <Database className="h-4 w-4 text-cyan-400 mb-1.5" />
            <span className="text-xs font-bold text-zinc-200 font-mono">Public Ledger</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">Immutable Prediction DOI</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-800/60 bg-[#0c0d12] text-center">
            <Award className="h-4 w-4 text-indigo-400 mb-1.5" />
            <span className="text-xs font-bold text-zinc-200 font-mono">Public Trust</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">Audited Performance</span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <Link
            href="/trust-center"
            className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3.5 text-sm font-bold text-[#09090B] transition-all hover:opacity-95 shadow-[0_0_20px_rgba(52,211,153,0.15)] flex items-center justify-center gap-2"
          >
            <ShieldCheck className="h-4 w-4" /> Explore Trust Center
          </Link>
          <Link
            href="/ledger"
            className="rounded-lg border border-zinc-800 bg-[#121215]/85 hover:bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-zinc-100 transition-colors flex items-center gap-2 justify-center font-mono"
          >
            Access Public Ledger <ArrowRight className="h-4 w-4 text-zinc-400" />
          </Link>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-zinc-500 font-mono"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Zero Look-Ahead LeakageGuard
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Pinnacle Closing Line Value (CLV)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Calibrated Brier Score &lt; 0.20
          </div>
        </motion.div>
      </div>
    </section>
  );
}

