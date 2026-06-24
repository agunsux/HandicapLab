'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';

const tiers = [
  {
    name: 'Free Sandbox',
    price: '$0',
    priceDesc: 'Forever free',
    desc: 'Evaluate model baseline metrics and ELO form indicators.',
    features: [
      '3 Daily fixtures analyzed',
      'Basic model probability feed',
      'Standard fatigue & ELO ratings',
      'Public accuracy verification'
    ],
    cta: 'Start Sandbox Access',
    popular: false
  },
  {
    name: 'Starter',
    price: '$9',
    priceDesc: 'per month',
    desc: 'Monitor matches and build tracking watchlists.',
    features: [
      'Unlimited match fixtures',
      'Personal match watchlist',
      'Standard ELO & resting details',
      'Delayed odds & prediction feeds'
    ],
    cta: 'Select Starter Plan',
    popular: false
  },
  {
    name: 'Pro',
    price: '$29',
    priceDesc: 'per month',
    desc: 'Unlocks full ensembled market recommendations and ELO statistics.',
    features: [
      'Full Edge Scanner suite',
      'Real-time Pinnacle odds feed',
      'Closing Line Value (CLV) log',
      'Brier Score & calibration checks',
      'Paper trading ledger access'
    ],
    cta: 'Unlock Pro Edge',
    popular: true
  },
  {
    name: 'Quant',
    price: '$99',
    priceDesc: 'per month',
    desc: 'Quant-grade ensembled outputs, programmatic API, and custom filter feeds.',
    features: [
      'All Pro features included',
      'Developer REST API & tokens',
      'Real-time webhook triggers',
      'Excel/CSV raw data exports',
      'Premium discord private feed'
    ],
    cta: 'Deploy Quant Feed',
    popular: false
  },
  {
    name: 'Founder Lifetime',
    price: '$199',
    priceDesc: 'one-time payment',
    desc: 'Perpetual access with no recurring bills. Limited founder licenses.',
    features: [
      'Perpetual Pro/Quant capabilities',
      'Permanent developer API token',
      '1-on-1 model calibration consultations',
      'No monthly renewal fees ever'
    ],
    cta: 'Get Lifetime License',
    popular: false
  }
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 border-t border-white/[0.05] bg-[#09090B] relative">
      {/* Background Radial Glow */}
      <div className="absolute top-[20%] left-[-10%] h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
            Transparent Pricing
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
            Flexible Plans. Calibrated Access.
          </h2>
          <p className="text-zinc-400 text-sm md:text-base">
            Choose the access tier that fits your betting volume. All plans feature programmatically verified settlement logs and zero future data bias.
          </p>
        </div>

        {/* Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {tiers.map((tier, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`rounded-xl border p-6 flex flex-col justify-between relative transition-all ${
                tier.popular
                  ? 'border-emerald-500 bg-[#121215] shadow-[0_0_30px_rgba(16,185,129,0.05)] md:scale-105 z-10'
                  : 'border-white/[0.05] bg-[#121215]/60 hover:border-zinc-800'
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-3 py-0.5 text-[10px] font-extrabold text-[#09090B] uppercase tracking-wider font-mono">
                  Recommended
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-zinc-100 font-sans">{tier.name}</h3>
                <p className="mt-2 text-xs text-zinc-550 leading-relaxed font-sans min-h-[48px]">{tier.desc}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-zinc-100 font-mono tracking-tight">{tier.price}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{tier.priceDesc}</span>
                </div>
                <div className="mt-6 space-y-3.5">
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs text-zinc-400">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <Link href="/pricing" className="block w-full">
                  <button
                    className={`w-full py-2.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                      tier.popular
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-[#09090B] hover:opacity-95'
                        : 'border border-zinc-800 text-zinc-100 bg-zinc-950/40 hover:bg-zinc-900'
                    }`}
                  >
                    {tier.cta}
                  </button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
