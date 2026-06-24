'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export default function CompetitorPositioning() {
  return (
    <section className="py-24 border-t border-white/[0.05] bg-[#09090B] relative">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
            Analytical Philosophy
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
            Why HandicapLab is Different
          </h2>
          <p className="text-zinc-400 text-sm md:text-base">
            We don't sell hot tips or guarantee match outcomes. We provide ensembled probability modeling to expose pricing inefficiencies.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Traditional Sites */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-white/[0.03] bg-[#121215]/30 p-8 space-y-6"
          >
            <h3 className="text-lg font-bold text-zinc-400 flex items-center gap-2">
              <span className="text-rose-500">✕</span> Traditional Prediction Sites
            </h3>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Typically run by tipsters who chase high-volume win streaks, obscure negative results, and encourage emotional betting selections.
            </p>
            <ul className="space-y-4 text-xs text-zinc-500">
              <li className="flex items-start gap-3">
                <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <span><strong>Guess Winners</strong>: Focus on predicting match outcomes rather than assessing bookmaker price discrepancies.</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <span><strong>Opaque Ledger</strong>: Cherry-pick winning steaks and delete or hide losing history.</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <span><strong>Black-box Predictions</strong>: Give percentages or win stars without statistical justifications or model explanations.</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <span><strong>Aggressive Betting</strong>: Recommend flat-rate staking sizing regardless of the value edge.</span>
              </li>
            </ul>
          </motion.div>

          {/* HandicapLab */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl border border-emerald-500/20 bg-[#121215]/80 p-8 space-y-6 shadow-[0_0_30px_rgba(16,185,129,0.02)]"
          >
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <span className="text-emerald-450">✔</span> HandicapLab Market Intelligence
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              A quant terminal that calculates statistical fair values and stake recommendations. We track all predictions programmatically.
            </p>
            <ul className="space-y-4 text-xs text-zinc-350">
              <li className="flex items-start gap-3">
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Measure Value Edges</strong>: Search for instances where ensembled probability fair odds beat public market odds.</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Auditable Performance</strong>: Public performance ledger lists all wins, losses, and voids in full.</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Model Calibration</strong>: Explicitly measure Brier Score calibration limits to ensure forecasts correspond to actual outcomes.</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Staking Risk Optimizer</strong>: Automate position allocations utilizing a calibrated fractional Kelly formula.</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
