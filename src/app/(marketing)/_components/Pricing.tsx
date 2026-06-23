'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, HelpCircle } from 'lucide-react';

const tiers = [
  {
    name: 'Free Trial',
    price: '$0',
    priceDesc: 'Forever free',
    desc: 'Evaluate model baseline metrics and ELO form indicators.',
    features: [
      '10 monthly prediction credits',
      'Moneyline (1X2) basic outcomes',
      'Standard fatigue & rest ratings',
      'Global accuracy verification'
    ],
    cta: 'Start Sandbox Access',
    popular: false
  },
  {
    name: 'Pro Trader',
    price: '$49',
    priceDesc: 'per month, billed monthly',
    desc: 'Unlocks full ensembled market recommendations and ELO statistics.',
    features: [
      'Unlimited ML & Asian Handicap picks',
      'Full fatigue, strength, and Elo indexes',
      'Access to Waitlist & Sandbox Ledger',
      'Brier Score & CLV details'
    ],
    cta: 'Unlock Pro Edge',
    popular: true
  },
  {
    name: 'Elite Institutional',
    price: '$149',
    priceDesc: 'per month, billed monthly',
    desc: 'Quant-grade ensembled outputs, alerts, and API feeds.',
    features: [
      'All Pro features included',
      'Dixon-Coles ensembled parameters export',
      'Real-time arbitrage & value alerts',
      'Full developer REST API & webhooks'
    ],
    cta: 'Deploy Institutional Feed',
    popular: false
  }
];

export default function Pricing() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`rounded-xl border p-8 flex flex-col justify-between relative transition-all ${
                tier.popular
                  ? 'border-emerald-500 bg-[#121215] shadow-[0_0_30px_rgba(16,185,129,0.05)] md:scale-105 z-10'
                  : 'border-white/[0.05] bg-[#121215]/60 hover:border-zinc-800'
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-3 py-0.5 text-[10px] font-extrabold text-[#09090B] uppercase tracking-wider font-mono">
                  Recommended Tier
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-zinc-100 font-sans">{tier.name}</h3>
                <p className="mt-2 text-xs text-zinc-500 leading-relaxed font-sans">{tier.desc}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-zinc-100 font-mono tracking-tight">{tier.price}</span>
                  <span className="text-xs text-zinc-500 font-mono">{tier.priceDesc}</span>
                </div>
                <div className="mt-8 space-y-4">
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-3 text-xs text-zinc-400">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10">
                <button
                  onClick={() => scrollToSection('waitlist')}
                  className={`w-full py-3 rounded-lg text-xs font-bold font-sans transition-all ${
                    tier.popular
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-[#09090B] hover:opacity-95'
                      : 'border border-zinc-800 text-zinc-100 bg-zinc-950/40 hover:bg-zinc-900'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
