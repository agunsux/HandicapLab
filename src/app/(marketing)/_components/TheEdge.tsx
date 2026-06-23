'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, BarChart3, Binary, Scale } from 'lucide-react';

const pillars = [
  {
    title: 'Dixon-Coles Goal Modeling',
    desc: 'Combines independent Double-Poisson distributions with custom rho-adjustments to calibrate low-scoring outcomes (0-0, 1-0, 0-1, 1-1).',
    icon: Binary,
    tag: 'PROBABILITY ENGINE'
  },
  {
    title: 'Platt & Isotonic Calibration',
    desc: 'Transforms raw model outputs into empirical probabilities. Ensures the forecast odds perfectly align with historical bookmaker closing margins.',
    icon: BarChart3,
    tag: 'CALIBRATION LAYER'
  },
  {
    title: 'Hard-Gated Leakage Guard',
    desc: 'Our strict LeakageGuard audits timestamps dynamically. Guarantees zero post-kickoff feature aggregation or odds future bias.',
    icon: ShieldAlert,
    tag: 'SYSTEM SECURITY'
  },
  {
    title: 'Staking Risk Optimizer',
    desc: 'Calculates optimal bankroll stakes utilizing fractional Kelly criterion (0.25 scaling) clamped at a 10% maximum risk allocation threshold.',
    icon: Scale,
    tag: 'RISK MANAGEMENT'
  }
];

export default function TheEdge() {
  return (
    <section id="the-edge" className="py-24 border-t border-white/[0.05] bg-[#0c0c0e] relative">
      {/* Background Radial Glow */}
      <div className="absolute bottom-[-10%] right-[10%] h-[350px] w-[350px] rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
            Under the Hood
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
            Where Machine Learning Meets Quant Finance
          </h2>
          <p className="text-zinc-400 text-sm md:text-base">
            HandicapLab rejects casual guesswork. We treat football outcomes as complex probability surfaces, modeling the edge using quant-grade methodologies.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="rounded-lg border border-white/[0.05] bg-[#121215]/80 p-6 flex gap-5 hover:border-emerald-500/20 transition-colors group"
            >
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 group-hover:scale-105 transition-transform">
                  <pillar.icon className="h-6 w-6" />
                </div>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-[9px] font-semibold text-zinc-500 tracking-wider uppercase block">
                  {pillar.tag}
                </span>
                <h3 className="text-lg font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
