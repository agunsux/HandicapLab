'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2 } from 'lucide-react';
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
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-400 font-mono"
        >
          <Sparkles className="h-3 w-3" />
          QUANTITATIVE FORECAST ENGINE 1.2
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-zinc-100 sm:text-5xl md:text-6xl"
        >
          Find statistical edges in{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            football markets.
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg leading-relaxed"
        >
          Quant models. Transparent tracking. Measured performance. Track ensembled Double Poisson and Dixon-Coles goal expectation parameters compared against live Pinnacle odds.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <Link href="/scanner" className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3.5 text-sm font-bold text-[#09090B] transition-all hover:opacity-95 shadow-[0_0_20px_rgba(52,211,153,0.15)] flex items-center justify-center">
            Explore Free Edge Scanner
          </Link>
          <Link
            href="/performance"
            className="rounded-lg border border-zinc-800 bg-[#121215]/85 hover:bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-zinc-100 transition-colors flex items-center gap-2 justify-center"
          >
            View Performance Ledger
          </Link>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-zinc-550 font-mono"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-450/80" /> Zero Look-ahead LeakageGuard
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-450/80" /> Pinnacle Closing Odds Audits
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-450/80" /> Calibrated Brier Score &lt; 0.20
          </div>
        </motion.div>
      </div>
    </section>
  );
}
